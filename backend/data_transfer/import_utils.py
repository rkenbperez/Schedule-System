import csv
import io
import zipfile
from dataclasses import dataclass, field
from datetime import time
from typing import Any
from uuid import uuid4

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email

# Shared normalization so preview and commit agree on what counts as a
# (possibly blank) email. users.services is import-safe here: it only touches
# models lazily inside its functions.
from users.services import normalize_email


SHEET_MODELS = [
    "Departments",
    "Rooms",
    "Subjects",
    "Sections",
    "Professors",
    "ProfessorPreferences",
    "Assignments",
    "Meetings",
    "Availability",
    "BusyBlocks",
]

# The generated template contains the 5 core sheets plus the optional
# ProfessorPreferences sheet (+ Instructions).
# The 4 legacy sheets remain accepted on upload for older 9-sheet workbooks.
TEMPLATE_SHEETS = ["Departments", "Rooms", "Subjects", "Sections", "Professors"]
TEMPLATE_ALL_SHEETS = [*TEMPLATE_SHEETS, "ProfessorPreferences"]

REQUIRED_COLUMNS = {
    "Departments": ["name"],
    "Rooms": ["name", "capacity"],
    "Subjects": ["code", "title"],
    "Sections": ["name", "headcount"],
    # Professors rows need email OR (legacy) user_id; enforced in _validate_rows.
    "Professors": [],
    "ProfessorPreferences": ["professor_email", "subject_code"],
    "Assignments": ["professor_id", "subject_id", "section_id"],
    "Meetings": ["assignment_id", "order", "mode"],
    "Availability": ["professor_id", "day", "start_time", "end_time"],
    "BusyBlocks": ["professor_id", "day", "start_time", "end_time"],
}

OPTIONAL_COLUMNS = {
    "Departments": [],
    "Rooms": ["department_id"],
    "Subjects": ["units"],
    "Sections": ["program"],
    "Professors": [
        "email",
        "first_name",
        "last_name",
        "department_id",
        "max_hours",
        "max_daily_hours",
        "max_consecutive",
        "user_id",
    ],
    "ProfessorPreferences": ["priority"],
    "Assignments": ["term_id"],
    "Meetings": ["duration_slots"],
    "Availability": ["is_preferred"],
    "BusyBlocks": [],
}

ALL_COLUMNS = {k: REQUIRED_COLUMNS[k] + OPTIONAL_COLUMNS[k] for k in SHEET_MODELS}

# Input whitelist: only these columns are read from uploaded workbooks.
# Formula/display columns (e.g. department_name) and unknown columns are
# discarded before any cell value is read, so missing cached formula values
# in LibreOffice/Google Sheets exports can never break an import.
EDITABLE_COLUMNS = {name: {"id", *ALL_COLUMNS[name]} for name in SHEET_MODELS}

VALID_MODES = {"async", "sync", "lab"}
VALID_DAYS = {0, 1, 2, 3, 4, 5}
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# The import parser accepts an optional "id" column on every sheet so existing
# records can be updated. Include it in downloaded templates even though it is
# not part of ALL_COLUMNS (which drives validation, not the workbook layout).
# Templates only cover the 5 core sheets; legacy sheets are upload-only.
TEMPLATE_COLUMNS = {
    name: ["id", *ALL_COLUMNS[name]]
    for name in TEMPLATE_SHEETS
    if name != "Professors"
}
# Professors templates are email-based; the legacy max_daily_hours and
# user_id headers remain accepted on upload but are not in the template.
TEMPLATE_COLUMNS["Professors"] = [
    "id",
    "email",
    "first_name",
    "last_name",
    "department_id",
    "max_hours",
    "max_consecutive",
]
TEMPLATE_COLUMNS["ProfessorPreferences"] = [
    "professor_email",
    "subject_code",
    "priority",
]

# Read-only display columns appended AFTER the input columns in the XLSX
# template only (never in CSV uploads). Each holds an INDEX/MATCH formula
# against the Departments tab; the parser ignores them because they are not
# in EDITABLE_COLUMNS.
TEMPLATE_DISPLAY_COLUMNS = {
    "Rooms": ("department_name", "D"),  # department_id is column D
    "Professors": ("department_name", "E"),  # department_id is column E
}

# Auto-fill formula rows written into Rooms/Professors regardless of data:
# rows 2..501 (500 rows) so users can paste large batches under the header.
TEMPLATE_FORMULA_ROWS = 500

# Hidden lookup sheet feeding the department_id dropdowns. Column A holds the
# Department ids that exist in the database; column B repeats the name for
# readability. The generous fixed range keeps working as departments are
# added without regenerating the template.
LISTS_SHEET_NAME = "_Lists"
DEPT_DROPDOWN_FORMULA = "_Lists!$A$2:$A$2000"

# One row per column so the Instructions tab explains the entire schema.
TEMPLATE_COLUMN_GUIDE = {
    "Departments": [
        ("id", "Optional", "Integer primary key. Leave blank to create; type an existing id to update. An id that does not exist in the database is rejected for that row."),
        ("name", "Required", "Unique department name (max 100 characters). Sample: Department of Computer Science."),
    ],
    "Rooms": [
        ("id", "Optional", "Integer primary key. Leave blank to create; type an existing id to update. An id that does not exist in the database is rejected for that row."),
        ("name", "Required", "Unique room name (max 50 characters). Samples: CS Lecture Room 1, CS Computer Laboratory 1."),
        ("capacity", "Required", "Positive integer seat capacity."),
        ("department_id", "Optional", "Department id. Pick from the dropdown (fed by the hidden _Lists sheet) or leave blank."),
    ],
    "Subjects": [
        ("id", "Optional", "Integer primary key. Leave blank to create; type an existing id to update. An id that does not exist in the database is rejected for that row."),
        ("code", "Required", "Unique subject code (max 20 characters). Sample: CS 201."),
        ("title", "Required", "Subject title (max 200 characters)."),
        ("units", "Optional", "Positive integer; defaults to 3."),
    ],
    "Sections": [
        ("id", "Optional", "Integer primary key. Leave blank to create; type an existing id to update. An id that does not exist in the database is rejected for that row."),
        ("name", "Required", "Unique section name (max 50 characters). Sample: BSCS 3-A."),
        ("headcount", "Required", "Positive integer number of students."),
        ("program", "Optional", "Program code such as BSCS or BSIT (max 20 characters). Leave blank to derive it from the section name."),
    ],
    "Professors": [
        ("id", "Optional", "Integer primary key. Leave blank to create; type an existing id to update. An id that does not exist in the database is rejected for that row."),
        ("email", "Required", "Professor's email address (case-insensitive). A new email creates the login account and profile; an existing email updates that professor. Passwords are never set or reset."),
        ("first_name", "Optional", "First name; only applied when provided."),
        ("last_name", "Optional", "Last name; only applied when provided."),
        ("department_id", "Optional", "Department id. Pick from the dropdown (fed by the hidden _Lists sheet) or leave blank."),
        ("max_hours", "Optional", "Maximum teaching hours per day; positive integer, defaults to 8."),
        ("max_consecutive", "Optional", "Positive integer; defaults to 4."),
    ],
    "ProfessorPreferences": [
        ("professor_email", "Required", "Professor's email (case-insensitive). Matches a professor already in the database or one created on the Professors sheet of this workbook."),
        ("subject_code", "Required", "Subject code (case-insensitive). Matches a subject already in the database or one created on the Subjects sheet of this workbook."),
        ("priority", "Optional", "Positive integer preference order for that professor. Leave blank to number the rows sequentially per professor."),
    ],
}

TEMPLATE_GENERAL_NOTES = [
    "XLSX: use the exact sheet names below. Row 1 is the header row; data starts in row 2.",
    "CSV: upload a .zip containing one .csv per sheet (Departments.csv, Rooms.csv, Subjects.csv, Sections.csv, Professors.csv). A single .csv file is not supported.",
    "Leave ID blank to CREATE a new record. Select from dropdown or type existing ID to UPDATE.",
    "A typed 'id' that does not exist in the database is rejected for that row; the other rows can still be imported.",
    "You must upload Departments/Subjects first before uploading Rooms/Professors.",
    "New professors can be added by leaving ID blank and typing a new email.",
    "department_id (Rooms and Professors): pick from the dropdown fed by the hidden _Lists sheet, or type an id that already exists in the database. Legacy sheets also cross-reference professor_id, subject_id, section_id, and assignment_id within the same workbook.",
    "Every assignment must have at least one synchronous meeting: mode 'sync' or 'lab' (legacy sheets only).",
    "Delivery modes: async, sync, lab. Day values: 0-5 or Monday-Saturday. Times: 24-hour HH:MM (legacy sheets only).",
    "Capacity, headcount, units, max_hours, max_consecutive, order, and duration_slots must be positive integers.",
    "Rooms have no room-type column. Use descriptive names such as 'CS Lecture Room 1' or 'CS Computer Laboratory 1'.",
    "Sections 'program' is optional (max 20 characters): leave it blank to derive it from the section name (e.g., 'BSCS 3-A' becomes BSCS).",
    "Professors are matched by email (case-insensitive): a new email creates the login account and profile; an existing email updates that professor. Passwords are never set or reset by an import.",
    "The 'department_name' columns (Rooms and Professors) auto-fill by formula once a valid department_id is entered; do not edit them.",
    "ProfessorPreferences is optional: list one preferred subject per row. An active academic term is required when it has rows.",
    "Legacy 9-sheet workbooks that also include Assignments, Meetings, Availability, and BusyBlocks sheets are still accepted on upload.",
]


@dataclass
class ImportError:
    sheet: str
    row: int
    field: str
    message: str


@dataclass
class ImportResult:
    valid: bool
    preview_token: str
    summary: dict = field(default_factory=lambda: {"creates": 0, "updates": 0, "skipped": 0, "errors": 0})
    details: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    parsed_data: dict = field(default_factory=dict)
    preview_items: dict = field(default_factory=dict)


@dataclass
class CommitResult:
    committed: bool
    summary: dict = field(default_factory=lambda: {"creates": 0, "updates": 0})
    errors: list = field(default_factory=list)


def parse_time(value: Any) -> time | None:
    if value is None or value == "":
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        value = value.strip()
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
            try:
                return time.fromisoformat(value) if ":" in value and len(value) <= 5 else None
            except ValueError:
                pass
        try:
            return time.fromisoformat(value)
        except ValueError:
            return None
    return None


def parse_day(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, int):
        return value if value in VALID_DAYS else None
    if isinstance(value, str):
        value = value.strip().lower()
        for i, name in enumerate(DAY_NAMES):
            if name.lower().startswith(value[:3]):
                return i
        try:
            return int(value)
        except ValueError:
            return None
    return None


def parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    if isinstance(value, float):
        return int(value)
    return None


def parse_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "y", "t")
    return bool(value)


def parse_mode(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        v = value.strip().lower()
        if v in VALID_MODES:
            return v
    return None


class ImportProcessor:
    PREVIEW_TTL = 900

    def parse_file(self, file) -> dict[str, list[dict]]:
        filename = getattr(file, "name", "").lower()
        if filename.endswith(".xlsx"):
            return self._parse_xlsx(file)
        elif filename.endswith(".zip"):
            return self._parse_csv_zip(file)
        else:
            raise ValueError("Unsupported file format. Use .xlsx or .zip (CSV)")

    @staticmethod
    def _parse_error(sheet: str, row: int, message: str) -> dict:
        return {"sheet": sheet, "row": row, "field": "", "message": message}

    def _parse_xlsx(self, file) -> dict[str, list[dict]]:
        wb = load_workbook(file, data_only=True)
        result: dict[str, list[dict]] = {name: [] for name in SHEET_MODELS}
        # Per-row parse failures (weird cell types, conversion errors) are
        # captured here instead of aborting the whole file; validate_all
        # drains them into structured errors.
        parse_errors: list[dict] = []
        result["_parse_errors"] = parse_errors
        # Presence and normalized header rows are tracked separately from the
        # row lists (which are pre-seeded empty for every known sheet), so
        # validate_all can tell a missing sheet from an empty one.
        present: list[str] = []
        headers_map: dict[str, list[str]] = {}
        for sheet_name in SHEET_MODELS:
            if sheet_name not in wb.sheetnames:
                continue
            present.append(sheet_name)
            headers_map[sheet_name] = []
            ws = wb[sheet_name]
            editable = EDITABLE_COLUMNS[sheet_name]
            rows = result[sheet_name]
            keep: list[tuple[int, str]] = []
            header_parsed = False
            for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
                try:
                    if i == 1:
                        # Normalize headers and keep only whitelisted input
                        # columns; formula/display and unknown columns are
                        # dropped before any cell value is read.
                        headers = [str(c).strip().lower() if c else "" for c in row]
                        headers_map[sheet_name] = headers
                        keep = [(j, h) for j, h in enumerate(headers) if h in editable]
                        header_parsed = True
                        continue
                    if not any(v is not None and v != "" for v in row):
                        continue
                    row_dict = {}
                    for j, h in keep:
                        if j < len(row):
                            row_dict[h] = row[j]
                    row_dict["_row_num"] = i
                    rows.append(row_dict)
                except Exception as e:
                    if not header_parsed:
                        parse_errors.append(
                            self._parse_error(
                                sheet_name, i, f"Unreadable header, sheet skipped: {e}"
                            )
                        )
                        break
                    parse_errors.append(
                        self._parse_error(sheet_name, i, f"Skipped malformed row: {e}")
                    )
        result["__present__"] = present
        result["__headers__"] = headers_map
        return result

    def _parse_csv_zip(self, file) -> dict[str, list[dict]]:
        result: dict[str, list[dict]] = {name: [] for name in SHEET_MODELS}
        parse_errors: list[dict] = []
        result["_parse_errors"] = parse_errors
        present: list[str] = []
        headers_map: dict[str, list[str]] = {}
        with zipfile.ZipFile(file, "r") as zf:
            for sheet_name in SHEET_MODELS:
                csv_name = f"{sheet_name}.csv"
                if csv_name not in zf.namelist():
                    continue
                present.append(sheet_name)
                editable = EDITABLE_COLUMNS[sheet_name]
                with zf.open(csv_name) as cf:
                    content = cf.read().decode("utf-8-sig")
                    reader = csv.DictReader(io.StringIO(content))
                    headers_map[sheet_name] = [
                        (h or "").strip().lower()
                        for h in (reader.fieldnames or [])
                    ]
                    i = 1  # header row; data starts at row 2
                    while True:
                        try:
                            row = next(reader, None)
                        except csv.Error as e:
                            i += 1
                            parse_errors.append(
                                self._parse_error(
                                    sheet_name, i, f"Skipped malformed CSV row: {e}"
                                )
                            )
                            continue
                        if row is None:
                            break
                        i += 1
                        try:
                            if not any(v is not None and v != "" for v in row.values()):
                                continue
                            row = {
                                k.strip().lower(): v
                                for k, v in row.items()
                                if k and k.strip().lower() in editable
                            }
                            row["_row_num"] = i
                            result[sheet_name].append(row)
                        except Exception as e:
                            parse_errors.append(
                                self._parse_error(
                                    sheet_name, i, f"Skipped malformed row: {e}"
                                )
                            )
        result["__present__"] = present
        result["__headers__"] = headers_map
        return result

    def validate_all(self, parsed_data: dict[str, list[dict]]) -> ImportResult:
        # Rows the parser could not read surface as structured row errors;
        # the remaining rows keep flowing through normal validation.
        parse_errors = parsed_data.pop("_parse_errors", [])
        present = set(parsed_data.pop("__present__", []))
        headers = parsed_data.pop("__headers__", {})
        result = ImportResult(valid=True, preview_token=str(uuid4()), parsed_data=parsed_data)
        for e in parse_errors:
            result.valid = False
            result.errors.append(
                ImportError(e.get("sheet", ""), e.get("row", 0), e.get("field", ""), e.get("message", ""))
            )
        structure_ok = self._validate_structure(present, headers, result)
        if not structure_ok:
            # A structurally invalid workbook (missing core sheet/header) has
            # no meaningful rows to import: never cache it, so it cannot be
            # committed even if the caller reuses the preview token.
            result.preview_token = ""
            return result
        # Validate rows even when some sibling rows failed parsing, so the
        # valid rows stay previewable and partially committable.
        self._validate_rows(parsed_data, result)
        self._validate_cross_model(parsed_data, result)
        self._compute_summary(parsed_data, result)
        # Cache the non-error row keys alongside the parsed rows: commit must
        # always exclude preview-errored rows, including selected_keys=None.
        error_keys = sorted(
            {f"{e.sheet}:{e.row}" for e in result.errors if e.row > 0}
        )
        cache.set(
            f"import_preview_{result.preview_token}",
            {"rows": parsed_data, "error_keys": error_keys},
            self.PREVIEW_TTL,
        )
        return result

    def _validate_structure(self, present: set, headers: dict, result: ImportResult) -> bool:
        # Only the 5 core sheets are required; the legacy sheets
        # (Assignments/Meetings/Availability/BusyBlocks) are optional and
        # treated as empty when missing.
        structure_ok = True
        for sheet_name in TEMPLATE_SHEETS:
            if sheet_name not in present:
                structure_ok = False
                result.valid = False
                result.errors.append(
                    ImportError(sheet_name, 0, "sheet", f"Missing sheet: {sheet_name}")
                )
                continue
            normalized = set(headers.get(sheet_name) or [])
            if sheet_name == "Professors":
                # Email is the canonical key, but legacy user_id workbooks
                # remain uploadable.
                if not ({"email", "user_id"} & normalized):
                    structure_ok = False
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            sheet_name,
                            0,
                            "sheet",
                            "Missing required header(s): email or user_id",
                        )
                    )
                continue
            missing = [
                col for col in REQUIRED_COLUMNS[sheet_name] if col not in normalized
            ]
            if missing:
                structure_ok = False
                result.valid = False
                result.errors.append(
                    ImportError(
                        sheet_name,
                        0,
                        "sheet",
                        f"Missing required header(s): {', '.join(missing)}",
                    )
                )
        # ProfessorPreferences is optional; when present its headers must be valid.
        if "ProfessorPreferences" in present:
            normalized = set(headers.get("ProfessorPreferences") or [])
            missing = [
                col
                for col in REQUIRED_COLUMNS["ProfessorPreferences"]
                if col not in normalized
            ]
            if missing:
                structure_ok = False
                result.valid = False
                result.errors.append(
                    ImportError(
                        "ProfessorPreferences",
                        0,
                        "sheet",
                        f"Missing required header(s): {', '.join(missing)}",
                    )
                )
        return structure_ok

    def _validate_rows(self, parsed_data: dict, result: ImportResult):
        for sheet_name in SHEET_MODELS:
            rows = parsed_data.get(sheet_name, [])
            required = REQUIRED_COLUMNS[sheet_name]
            all_cols = ALL_COLUMNS[sheet_name]
            for row in rows:
                row_num = row.get("_row_num", 0)
                for col in required:
                    val = row.get(col)
                    if val is None or val == "":
                        result.valid = False
                        result.errors.append(ImportError(sheet_name, row_num, col, f"Required field '{col}' is empty"))
                if (
                    sheet_name == "Professors"
                    and not normalize_email(str(row.get("email") or ""))
                    and not row.get("user_id")
                ):
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            sheet_name,
                            row_num,
                            "email",
                            "Professors row requires 'email' (or legacy 'user_id')",
                        )
                    )
                for col, val in row.items():
                    if col == "_row_num" or col not in all_cols:
                        continue
                    if sheet_name == "Rooms" and col == "capacity":
                        ival = parse_int(val)
                        if ival is None or ival <= 0:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Capacity must be positive integer"))
                    elif sheet_name == "Subjects" and col == "units":
                        if val is not None and str(val).strip() != "":
                            ival = parse_int(val)
                            if ival is None:
                                result.valid = False
                                result.errors.append(ImportError(sheet_name, row_num, col, "Units must be an integer"))
                            elif ival <= 0:
                                result.valid = False
                                result.errors.append(ImportError(sheet_name, row_num, col, "Units must be positive integer"))
                    elif sheet_name == "Sections" and col == "headcount":
                        ival = parse_int(val)
                        if ival is None or ival <= 0:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Headcount must be positive integer"))
                    elif sheet_name == "Meetings" and col == "mode":
                        if parse_mode(val) is None:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, f"Invalid mode '{val}'. Must be one of: async, sync, lab"))
                    elif sheet_name == "Meetings" and col == "duration_slots":
                        ival = parse_int(val)
                        if ival is not None and ival < 1:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Duration slots must be >= 1"))
                    elif sheet_name == "Meetings" and col == "order":
                        ival = parse_int(val)
                        if ival is None or ival < 1:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Order must be >= 1"))
                    elif sheet_name in ("Availability", "BusyBlocks") and col == "day":
                        if parse_day(val) is None:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, f"Invalid day '{val}'. Must be 0-5 or day name"))
                    elif sheet_name in ("Availability", "BusyBlocks") and col in ("start_time", "end_time"):
                        if parse_time(val) is None:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, f"Invalid time format '{val}'. Use HH:MM"))
                    elif sheet_name in ("Availability", "BusyBlocks") and col == "is_preferred":
                        if parse_bool(val) is None:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Must be true/false"))
                    elif sheet_name == "Professors" and col == "email":
                        sval = normalize_email(str(val) if val is not None else "")
                        if sval:
                            try:
                                validate_email(sval)
                            except DjangoValidationError:
                                result.valid = False
                                result.errors.append(
                                    ImportError(sheet_name, row_num, col, f"Invalid email '{val}'")
                                )
                    elif sheet_name == "Professors" and col in ("first_name", "last_name"):
                        sval = str(val).strip() if val is not None else ""
                        if len(sval) > 150:
                            result.valid = False
                            result.errors.append(
                                ImportError(sheet_name, row_num, col, "Must be 150 characters or fewer")
                            )
                    elif sheet_name == "Professors" and col in ("max_hours", "max_daily_hours", "max_consecutive"):
                        # max_hours is the canonical sheet header for
                        # Professors.max_daily_hours; legacy header accepted.
                        if val is not None and str(val).strip() != "":
                            ival = parse_int(val)
                            if ival is None:
                                result.valid = False
                                result.errors.append(ImportError(sheet_name, row_num, col, "Must be an integer"))
                            elif ival < 1:
                                result.valid = False
                                result.errors.append(ImportError(sheet_name, row_num, col, "Must be positive integer"))
                    elif sheet_name == "Sections" and col == "program":
                        sval = str(val).strip() if val is not None else ""
                        if len(sval) > 20:
                            result.valid = False
                            result.errors.append(
                                ImportError(sheet_name, row_num, col, "Program must be 20 characters or fewer")
                            )
                    elif sheet_name == "ProfessorPreferences" and col == "professor_email":
                        sval = normalize_email(str(val) if val is not None else "")
                        if not sval:
                            # Truly empty cells are already reported by the
                            # required-field check; only whitespace slips past it.
                            if str(val or "").strip():
                                result.valid = False
                                result.errors.append(
                                    ImportError(sheet_name, row_num, col, "Required field 'professor_email' is empty")
                                )
                        else:
                            try:
                                validate_email(sval)
                            except DjangoValidationError:
                                result.valid = False
                                result.errors.append(
                                    ImportError(sheet_name, row_num, col, f"Invalid email '{val}'")
                                )
                    elif sheet_name == "ProfessorPreferences" and col == "priority":
                        if val is not None and str(val).strip() != "":
                            ival = parse_int(val)
                            if ival is None or ival <= 0:
                                result.valid = False
                                result.errors.append(
                                    ImportError(sheet_name, row_num, col, "Priority must be positive integer")
                                )

    def _validate_cross_model(self, parsed_data: dict, result: ImportResult):
        from catalog.models import Department, Subject
        from timetable.models import AcademicTerm

        # department_id must reference a department that already exists in
        # the database. Ids defined only in this workbook's Departments sheet
        # are rejected: upload Departments first, then Rooms/Professors.
        db_dept_ids = set(Department.objects.values_list("id", flat=True))
        room_names = {r.get("name") for r in parsed_data.get("Rooms", []) if r.get("name")}
        subject_codes = {r.get("code") for r in parsed_data.get("Subjects", []) if r.get("code")}
        section_names = {r.get("name") for r in parsed_data.get("Sections", []) if r.get("name")}
        prof_ids = {r.get("id") for r in parsed_data.get("Professors", []) if r.get("id")}
        prof_user_ids = {
            uid
            for uid in (parse_int(r.get("user_id")) for r in parsed_data.get("Professors", []))
            if uid
        }
        assignment_ids = {r.get("id") for r in parsed_data.get("Assignments", []) if r.get("id")}
        assignment_keys = set()

        # Validate professor user_ids exist in database (legacy user_id rows)
        from django.contrib.auth import get_user_model
        from users.models import Professors
        User = get_user_model()
        existing_user_ids = set(User.objects.filter(id__in=prof_user_ids).values_list("id", flat=True))
        for row in parsed_data.get("Professors", []):
            user_id = parse_int(row.get("user_id"))
            if user_id and user_id not in existing_user_ids:
                result.valid = False
                result.errors.append(ImportError("Professors", row.get("_row_num", 0), "user_id", f"User {user_id} does not exist"))

        # Duplicate emails within the workbook (case-insensitive) and the
        # id/email precedence rule: a row carrying both an existing professor
        # id and an email must match that professor's user email, so one
        # professor's row cannot hijack another user's account.
        seen_emails = {}
        for row in parsed_data.get("Professors", []):
            row_num = row.get("_row_num", 0)
            email = normalize_email(str(row.get("email") or ""))
            if email:
                if email in seen_emails:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "Professors",
                            row_num,
                            "email",
                            f"Duplicate email '{email}' in workbook (also on row {seen_emails[email]})",
                        )
                    )
                else:
                    seen_emails[email] = row_num
            pid = parse_int(row.get("id"))
            if pid and email:
                prof = Professors.objects.filter(id=pid).select_related("user").first()
                if prof and normalize_email(prof.user.email or "") != email:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "Professors",
                            row_num,
                            "email",
                            f"Email '{email}' does not match the existing professor {pid} account email",
                        )
                    )

        # ProfessorPreferences resolve professors and subjects by email/code,
        # accepting both database rows and rows created by this workbook.
        pref_rows = parsed_data.get("ProfessorPreferences", [])
        if pref_rows:
            workbook_emails = {
                normalize_email(str(row.get("email") or ""))
                for row in parsed_data.get("Professors", [])
            }
            known_emails = workbook_emails | {
                normalize_email(email)
                for email in Professors.objects.filter(
                    user__email__isnull=False
                ).values_list("user__email", flat=True)
            }
            known_emails.discard("")
            # Preference submissions are grouped per department, so a
            # preference for a professor without one cannot be submitted.
            workbook_prof_depts = {}
            for prof_row in parsed_data.get("Professors", []):
                prof_email = normalize_email(str(prof_row.get("email") or ""))
                if prof_email:
                    workbook_prof_depts[prof_email] = parse_int(
                        prof_row.get("department_id")
                    )
            db_prof_depts = {
                normalize_email(email): dept_id
                for email, dept_id in Professors.objects.filter(
                    user__email__isnull=False
                ).values_list("user__email", "department_id")
            }
            known_codes = {
                str(row.get("code") or "").strip().casefold()
                for row in parsed_data.get("Subjects", [])
            } | {
                code.casefold()
                for code in Subject.objects.values_list("code", flat=True)
            }
            has_active_term = AcademicTerm.objects.filter(is_active=True).exists()
            seen_pairs = {}
            for row in pref_rows:
                row_num = row.get("_row_num", 0)
                email = normalize_email(str(row.get("professor_email") or ""))
                code = str(row.get("subject_code") or "").strip()
                if email and email not in known_emails:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "ProfessorPreferences",
                            row_num,
                            "professor_email",
                            f"Professor with email '{email}' not found",
                        )
                    )
                elif email and not (
                    workbook_prof_depts.get(email) or db_prof_depts.get(email)
                ):
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "ProfessorPreferences",
                            row_num,
                            "department_id",
                            f"Professor '{email}' has no department; set "
                            "department_id on the Professors sheet so the "
                            "preference can be submitted.",
                        )
                    )
                if code and code.casefold() not in known_codes:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "ProfessorPreferences",
                            row_num,
                            "subject_code",
                            f"Subject '{code}' not found",
                        )
                    )
                if email and code:
                    key = (email, code.casefold())
                    if key in seen_pairs:
                        result.valid = False
                        result.errors.append(
                            ImportError(
                                "ProfessorPreferences",
                                row_num,
                                "subject_code",
                                f"Duplicate professor '{email}' and subject '{code}' "
                                f"(also on row {seen_pairs[key]})",
                            )
                        )
                    else:
                        seen_pairs[key] = row_num
                if not has_active_term:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            "ProfessorPreferences",
                            row_num,
                            "term",
                            "No active AcademicTerm found. Mark a term active before importing preferences.",
                        )
                    )

        for sheet_name in ("Rooms", "Professors"):
            for row in parsed_data.get(sheet_name, []):
                raw = row.get("department_id")
                if raw is None or str(raw).strip() == "":
                    continue
                did = parse_int(raw)
                if did is None:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            sheet_name,
                            row.get("_row_num", 0),
                            "department_id",
                            f"department_id '{raw}' must be an integer",
                        )
                    )
                elif did not in db_dept_ids:
                    result.valid = False
                    result.errors.append(
                        ImportError(
                            sheet_name,
                            row.get("_row_num", 0),
                            "department_id",
                            f"Department {did} not found in database",
                        )
                    )

        for row in parsed_data.get("Assignments", []):
            pid = row.get("professor_id")
            sid = row.get("subject_id")
            secid = row.get("section_id")
            if pid and pid not in prof_ids:
                result.valid = False
                result.errors.append(ImportError("Assignments", row.get("_row_num", 0), "professor_id", f"Professor {pid} not found"))
            if sid and sid not in {r.get("id") for r in parsed_data.get("Subjects", []) if r.get("id")}:
                result.valid = False
                result.errors.append(ImportError("Assignments", row.get("_row_num", 0), "subject_id", f"Subject {sid} not found"))
            if secid and secid not in {r.get("id") for r in parsed_data.get("Sections", []) if r.get("id")}:
                result.valid = False
                result.errors.append(ImportError("Assignments", row.get("_row_num", 0), "section_id", f"Section {secid} not found"))
            key = (pid, sid, secid)
            if key in assignment_keys:
                result.valid = False
                result.errors.append(ImportError("Assignments", row.get("_row_num", 0), "id", f"Duplicate assignment for professor {pid}, subject {sid}, section {secid}"))
            assignment_keys.add(key)

        for row in parsed_data.get("Meetings", []):
            aid = row.get("assignment_id")
            if aid and aid not in assignment_ids:
                result.valid = False
                result.errors.append(ImportError("Meetings", row.get("_row_num", 0), "assignment_id", f"Assignment {aid} not found"))
            order = row.get("order")
            if aid and order:
                if (aid, order) in assignment_keys:
                    result.valid = False
                    result.errors.append(ImportError("Meetings", row.get("_row_num", 0), "order", f"Duplicate order {order} for assignment {aid}"))
                assignment_keys.add((aid, order))

        for row in parsed_data.get("Availability", []):
            pid = row.get("professor_id")
            if pid and pid not in prof_ids:
                result.valid = False
                result.errors.append(ImportError("Availability", row.get("_row_num", 0), "professor_id", f"Professor {pid} not found"))

        for row in parsed_data.get("BusyBlocks", []):
            pid = row.get("professor_id")
            if pid and pid not in prof_ids:
                result.valid = False
                result.errors.append(ImportError("BusyBlocks", row.get("_row_num", 0), "professor_id", f"Professor {pid} not found"))

        sync_modes = {"sync", "lab"}
        assignment_meetings = {}
        for row in parsed_data.get("Meetings", []):
            aid = row.get("assignment_id")
            mode = parse_mode(row.get("mode"))
            if aid not in assignment_meetings:
                assignment_meetings[aid] = []
            assignment_meetings[aid].append(mode)

        for row in parsed_data.get("Assignments", []):
            aid = row.get("id")
            modes = assignment_meetings.get(aid, [])
            if not any(m in sync_modes for m in modes):
                result.valid = False
                result.errors.append(ImportError("Assignments", row.get("_row_num", 0), "meetings", "Assignment must have at least one synchronous (sync or lab) meeting"))

    def _compute_summary(self, parsed_data: dict, result: ImportResult):
        from catalog.models import Department, Room, Subject, Section
        from users.models import Professors
        from timetable.models import Assignment, MeetingSlot, AvailabilityWindow, BusyBlock
        from django.contrib.auth import get_user_model

        User = get_user_model()

        model_map = {
            "Departments": (Department, "id"),
            "Rooms": (Room, "id"),
            "Subjects": (Subject, "id"),
            "Sections": (Section, "id"),
            "Professors": (Professors, "id"),
            "Assignments": (Assignment, "id"),
            "Meetings": (MeetingSlot, "id"),
            "Availability": (AvailabilityWindow, "id"),
            "BusyBlocks": (BusyBlock, "id"),
        }

        # Build error lookup by (sheet, row_num)
        error_lookup = {}
        for e in result.errors:
            error_lookup.setdefault((e.sheet, e.row), []).append(e.message)

        # Key display fields per entity for preview tables
        display_fields = {
            "Departments": ["name"],
            "Rooms": ["name", "capacity", "department_id"],
            "Subjects": ["code", "title", "units"],
            "Sections": ["name", "headcount", "program", "year_level", "term_id"],
            "Professors": ["email", "first_name", "last_name", "department_id", "max_hours"],
            "ProfessorPreferences": ["professor_email", "subject_code", "priority"],
            "Assignments": ["professor_id", "subject_id", "section_id", "term_id"],
            "Meetings": ["assignment_id", "order", "mode", "duration_slots"],
            "Availability": ["professor_id", "day", "start_time", "end_time", "is_preferred"],
            "BusyBlocks": ["professor_id", "day", "start_time", "end_time"],
        }

        result.preview_items = {}

        for sheet_name, (model, pk_field) in model_map.items():
            creates = 0
            updates = 0
            items = []

            # Core template sheets: a typed id must exist in the database
            # (blank id = create with a DB-generated pk). Legacy sheets keep
            # the previous behavior for old 9-sheet workbooks.
            enforce_id_exists = sheet_name in TEMPLATE_SHEETS

            for row in parsed_data.get(sheet_name, []):
                row_num = row.get("_row_num", 0)
                row_errors = list(error_lookup.get((sheet_name, row_num), []))
                pk_raw = row.get(pk_field)
                pk_num = parse_int(pk_raw) if pk_raw not in (None, "") else None
                email_value = normalize_email(str(row.get("email") or ""))

                if row_errors:
                    action = "error"
                elif enforce_id_exists and pk_raw not in (None, "") and pk_num is None:
                    err = ImportError(
                        sheet_name,
                        row_num,
                        "id",
                        f"Invalid id '{pk_raw}': must be a whole number",
                    )
                    result.valid = False
                    result.errors.append(err)
                    row_errors.append(err.message)
                    action = "error"
                elif enforce_id_exists and pk_num is not None:
                    if model.objects.filter(**{pk_field: pk_num}).exists():
                        action = "update"
                        updates += 1
                    else:
                        err = ImportError(
                            sheet_name,
                            row_num,
                            "id",
                            f"id {pk_num} does not exist. Leave id blank to create a new record.",
                        )
                        result.valid = False
                        result.errors.append(err)
                        row_errors.append(err.message)
                        action = "error"
                elif sheet_name == "Professors" and email_value:
                    # Email rows: an existing user WITH a Professors profile
                    # is an update; anything else (new email, or existing
                    # user without a profile) creates the profile.
                    has_user = User.objects.filter(email__iexact=email_value).exists()
                    has_prof = Professors.objects.filter(user__email__iexact=email_value).exists()
                    if has_user and has_prof:
                        action = "update"
                        updates += 1
                    else:
                        action = "create"
                        creates += 1
                else:
                    pk_val = row.get(pk_field)
                    if pk_val:
                        exists = model.objects.filter(**{pk_field: pk_val}).exists()
                        if exists:
                            action = "update"
                            updates += 1
                        else:
                            action = "create"
                            creates += 1
                    else:
                        action = "create"
                        creates += 1

                # Build key-field display data for this row
                row_data = {}
                for field in display_fields.get(sheet_name, []):
                    val = row.get(field)
                    if val is not None and val != "":
                        row_data[field] = val

                items.append({
                    "row": row_num,
                    "action": action,
                    "errors": row_errors,
                    "data": row_data,
                })

            result.summary["creates"] += creates
            result.summary["updates"] += updates

            if items:
                result.preview_items[sheet_name] = items

            if creates or updates:
                result.details.append({
                    "model": sheet_name,
                    "action": "create" if creates and not updates else ("update" if updates and not creates else "mixed"),
                    "count": creates + updates,
                })

        pref_rows = parsed_data.get("ProfessorPreferences", [])
        if pref_rows:
            from timetable.models import AcademicTerm
            from users.models import ProfessorPreference

            active_term = AcademicTerm.objects.filter(is_active=True).first()
            creates = 0
            updates = 0
            items = []
            for row in pref_rows:
                row_num = row.get("_row_num", 0)
                row_errors = list(error_lookup.get(("ProfessorPreferences", row_num), []))
                email = normalize_email(str(row.get("professor_email") or ""))
                code = str(row.get("subject_code") or "").strip()
                if row_errors or not active_term:
                    action = "error"
                else:
                    prof = Professors.objects.filter(
                        user__email__iexact=email
                    ).first()
                    subject = Subject.objects.filter(code__iexact=code).first()
                    exists = (
                        prof
                        and subject
                        and ProfessorPreference.objects.filter(
                            professor=prof,
                            subject=subject,
                            section__isnull=True,
                            term=active_term,
                        ).exists()
                    )
                    if exists:
                        action = "update"
                        updates += 1
                    else:
                        action = "create"
                        creates += 1
                data = {}
                for field in display_fields["ProfessorPreferences"]:
                    val = row.get(field)
                    if val is not None and val != "":
                        data[field] = val
                items.append({
                    "row": row_num,
                    "action": action,
                    "errors": row_errors,
                    "data": data,
                })
            result.summary["creates"] += creates
            result.summary["updates"] += updates
            result.preview_items["ProfessorPreferences"] = items
            if creates or updates:
                result.details.append({
                    "model": "ProfessorPreferences",
                    "action": "create" if creates and not updates else ("update" if updates and not creates else "mixed"),
                    "count": creates + updates,
                })

    @staticmethod
    def _ensure_pk_exists(model, pk) -> int:
        """Defensive guard: a provided id must reference an existing row.

        The preview already flags nonexistent ids as row errors; this last
        check raises inside the atomic transaction so a stale or hand-crafted
        commit payload can never insert a record with an arbitrary pk — the
        whole import rolls back instead.
        """
        pk_num = parse_int(pk)
        if pk_num is None or not model.objects.filter(id=pk_num).exists():
            raise ValueError(f"{model.__name__} id {pk} does not exist")
        return pk_num

    def commit(
        self,
        preview_token: str,
        selected_keys: list[str] | None = None,
        submitted_by=None,
    ) -> CommitResult:
        cached = cache.get(f"import_preview_{preview_token}")
        if not cached:
            return CommitResult(committed=False, errors=[{"message": "Preview token expired or invalid"}])

        # New cache shape: {"rows": ..., "error_keys": [...]}. Tolerate the
        # old bare-dict shape defensively (e.g. tokens cached before deploy).
        if isinstance(cached, dict) and "rows" in cached:
            parsed_data = cached.get("rows") or {}
            error_keys = set(cached.get("error_keys") or [])
        else:
            parsed_data = cached
            error_keys = set()

        selected = set(selected_keys) if selected_keys is not None else None
        # Never commit preview-errored rows: selected_keys=None means "all
        # non-error rows", and an explicit selection cannot opt an error row
        # back in. Build fresh lists so the cached payload is never mutated.
        parsed_data = {
            sheet: [
                row
                for row in rows
                if f"{sheet}:{row.get('_row_num', 0)}" not in error_keys
                and (
                    selected is None
                    or f"{sheet}:{row.get('_row_num', 0)}" in selected
                )
            ]
            for sheet, rows in parsed_data.items()
        }

        result = CommitResult(committed=True)
        try:
            from django.db import transaction
            from catalog.models import Department, Room, Subject, Section
            from users.models import (
                PreferenceSubmission,
                ProfessorPreference,
                Professors,
                SubmissionItem,
            )
            from users.services import provision_professor
            from timetable.models import (
                AcademicTerm,
                Assignment,
                MeetingSlot,
                AvailabilityWindow,
                BusyBlock,
            )
            from django.contrib.auth import get_user_model

            User = get_user_model()

            with transaction.atomic():
                # Departments
                for row in parsed_data.get("Departments", []):
                    pk = row.get("id")
                    if pk not in (None, ""):
                        self._ensure_pk_exists(Department, pk)
                    defaults = {"name": row["name"]}
                    if pk:
                        obj, created = Department.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = Department.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Rooms
                for row in parsed_data.get("Rooms", []):
                    pk = row.get("id")
                    if pk not in (None, ""):
                        self._ensure_pk_exists(Room, pk)
                    defaults = {
                        "name": row["name"],
                        "capacity": parse_int(row["capacity"]),
                        "department_id": parse_int(row.get("department_id")) or None,
                    }
                    if pk:
                        obj, created = Room.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = Room.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Subjects
                for row in parsed_data.get("Subjects", []):
                    pk = row.get("id")
                    if pk not in (None, ""):
                        self._ensure_pk_exists(Subject, pk)
                    defaults = {
                        "code": row["code"],
                        "title": row["title"],
                        "units": parse_int(row.get("units")) or 3,
                    }
                    if pk:
                        obj, created = Subject.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = Subject.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Sections
                for row in parsed_data.get("Sections", []):
                    pk = row.get("id")
                    if pk not in (None, ""):
                        self._ensure_pk_exists(Section, pk)
                    defaults = {
                        "name": row["name"],
                        "headcount": parse_int(row["headcount"]),
                        "term_id": parse_int(row.get("term_id")) or None,
                        # Blank program is derived from the name by Section.save().
                        "program": (row.get("program") or "").strip(),
                    }
                    if pk:
                        obj, created = Section.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = Section.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Professors
                for row in parsed_data.get("Professors", []):
                    email = normalize_email(str(row.get("email") or ""))
                    if email:
                        # Email-based provisioning (max_hours is the canonical
                        # header for Professors.max_daily_hours; legacy
                        # max_daily_hours still accepted).
                        pk = row.get("id")
                        if pk not in (None, ""):
                            self._ensure_pk_exists(Professors, pk)
                        provisioned = provision_professor(
                            email=email,
                            first_name=row.get("first_name") or "",
                            last_name=row.get("last_name") or "",
                            department_id=parse_int(row.get("department_id")) or None,
                            max_daily_hours=(
                                parse_int(row.get("max_hours"))
                                or parse_int(row.get("max_daily_hours"))
                                or None
                            ),
                            max_consecutive=parse_int(row.get("max_consecutive")) or None,
                        )
                        if provisioned.action == "created":
                            result.summary["creates"] += 1
                        else:
                            result.summary["updates"] += 1
                        continue
                    # Legacy user_id-based row (pre-email workbooks): keep the
                    # previous behavior of validating the user and updating or
                    # creating the profile by id/user_id.
                    pk = row.get("id")
                    if pk not in (None, ""):
                        self._ensure_pk_exists(Professors, pk)
                    user_id = parse_int(row.get("user_id"))
                    if not user_id or not User.objects.filter(id=user_id).exists():
                        raise ValueError(f"User {user_id} does not exist")
                    defaults = {
                        "user_id": user_id,
                        "department_id": parse_int(row.get("department_id")) or None,
                        "max_daily_hours": parse_int(row.get("max_daily_hours")) or 8,
                        "max_consecutive": parse_int(row.get("max_consecutive")) or 4,
                    }
                    if pk:
                        obj, created = Professors.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj, created = Professors.objects.update_or_create(user_id=user_id, defaults=defaults)
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # ProfessorPreferences (optional sheet). Runs after Professors
                # and Subjects so workbook-created rows exist in the database.
                pref_rows = parsed_data.get("ProfessorPreferences", [])
                if pref_rows:
                    from django.db.models import Max

                    active_term = AcademicTerm.objects.filter(is_active=True).first()
                    if active_term is None:
                        raise ValueError(
                            "No active AcademicTerm found. Mark a term active "
                            "before importing preferences."
                        )
                    next_priority = {}
                    submissions = {}
                    for row in pref_rows:
                        email = normalize_email(
                            str(row.get("professor_email") or "")
                        )
                        code = str(row.get("subject_code") or "").strip()
                        prof = Professors.objects.select_related("user").filter(
                            user__email__iexact=email
                        ).first()
                        if prof is None:
                            raise ValueError(
                                f"Professor with email '{email}' not found"
                            )
                        subject = Subject.objects.filter(code__iexact=code).first()
                        if subject is None:
                            raise ValueError(f"Subject '{code}' not found")

                        if prof.pk not in next_priority:
                            highest = (
                                ProfessorPreference.objects.filter(
                                    professor=prof,
                                    term=active_term,
                                    section__isnull=True,
                                ).aggregate(Max("priority"))["priority__max"]
                                or 0
                            )
                            next_priority[prof.pk] = highest + 1
                        priority = parse_int(row.get("priority"))
                        if priority is None:
                            priority = next_priority[prof.pk]
                        next_priority[prof.pk] = max(
                            next_priority[prof.pk], priority + 1
                        )

                        pref, created = ProfessorPreference.objects.update_or_create(
                            professor=prof,
                            subject=subject,
                            section=None,
                            term=active_term,
                            defaults={"priority": priority},
                        )
                        if created:
                            result.summary["creates"] += 1
                        else:
                            result.summary["updates"] += 1

                        if not prof.department_id:
                            raise ValueError(
                                f"Professor with email '{email}' has no "
                                "department; the preference cannot be "
                                "submitted without one."
                            )
                        submission = submissions.get(prof.department_id)
                        if submission is None:
                            submission, _ = (
                                PreferenceSubmission.objects.get_or_create(
                                    department_id=prof.department_id,
                                    term=active_term,
                                    defaults={"submitted_by": submitted_by},
                                )
                            )
                            submissions[prof.department_id] = submission
                        SubmissionItem.objects.update_or_create(
                            submission=submission,
                            preference=pref,
                            defaults={"action": "publish", "notes": ""},
                        )

                # Assignments (legacy sheet: a typed id creates that record)
                for row in parsed_data.get("Assignments", []):
                    pk = row.get("id")
                    defaults = {
                        "prof_id": parse_int(row["professor_id"]),
                        "subject_id": parse_int(row["subject_id"]),
                        "section_id": parse_int(row["section_id"]),
                        "term_id": parse_int(row.get("term_id")) or None,
                    }
                    if pk:
                        obj, created = Assignment.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = Assignment.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Meetings
                from timetable.models import get_mode_duration

                for row in parsed_data.get("Meetings", []):
                    pk = row.get("id")
                    mode = parse_mode(row["mode"])
                    defaults = {
                        "assignment_id": parse_int(row["assignment_id"]),
                        "order": parse_int(row["order"]),
                        "mode": mode,
                        "duration_slots": (
                            parse_int(row.get("duration_slots"))
                            or get_mode_duration(mode)
                        ),
                    }
                    if pk:
                        obj, created = MeetingSlot.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = MeetingSlot.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Availability
                for row in parsed_data.get("Availability", []):
                    pk = row.get("id")
                    defaults = {
                        "prof_id": parse_int(row["professor_id"]),
                        "day": parse_day(row["day"]),
                        "start_time": parse_time(row["start_time"]),
                        "end_time": parse_time(row["end_time"]),
                        "is_preferred": parse_bool(row.get("is_preferred")) or False,
                    }
                    if pk:
                        obj, created = AvailabilityWindow.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = AvailabilityWindow.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # BusyBlocks
                for row in parsed_data.get("BusyBlocks", []):
                    pk = row.get("id")
                    defaults = {
                        "prof_id": parse_int(row["professor_id"]),
                        "day": parse_day(row["day"]),
                        "start_time": parse_time(row["start_time"]),
                        "end_time": parse_time(row["end_time"]),
                    }
                    if pk:
                        obj, created = BusyBlock.objects.update_or_create(id=pk, defaults=defaults)
                    else:
                        obj = BusyBlock.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

            cache.delete(f"import_preview_{preview_token}")
            return result

        except Exception as e:
            result.committed = False
            result.errors.append({"message": str(e)})
            return result

    def _write_department_list_sheet(self, wb) -> None:
        """Hidden `_Lists` sheet holding the live department ids.

        Column A feeds the department_id dropdowns on Rooms and Professors;
        column B repeats the department name for readability.
        """
        from catalog.models import Department

        ws = wb.create_sheet(LISTS_SHEET_NAME)
        ws.sheet_state = "hidden"
        ws.append(["department_id", "department_name"])
        for dept_id, dept_name in Department.objects.order_by("id").values_list(
            "id", "name"
        ):
            ws.append([dept_id, dept_name])

    def generate_template_xlsx(self) -> bytes:
        wb = Workbook()
        header_fill = PatternFill("solid", fgColor="1E7145")
        header_font = Font(bold=True, color="FFFFFF")
        section_fill = PatternFill("solid", fgColor="E8F5E9")
        section_font = Font(bold=True, color="1B5E20")
        ro_fill = PatternFill("solid", fgColor="ECEFF1")

        for sheet_name in TEMPLATE_ALL_SHEETS:
            if sheet_name == TEMPLATE_ALL_SHEETS[0]:
                ws = wb.active
                ws.title = sheet_name
            else:
                ws = wb.create_sheet(sheet_name)

            # Headers only: no database rows and no sample rows, so the
            # template stays identical whether or not the database is empty.
            columns = TEMPLATE_COLUMNS[sheet_name]
            ws.append(columns)

            # Read-only display column appended after the input columns,
            # auto-filled for TEMPLATE_FORMULA_ROWS regardless of data. It
            # evaluates to blank until a valid department_id is typed or
            # picked from the dropdown.
            display = TEMPLATE_DISPLAY_COLUMNS.get(sheet_name)
            total_columns = len(columns)
            all_names = list(columns)
            if display:
                display_name, ref_col = display
                display_idx = total_columns + 1
                ws.cell(row=1, column=display_idx, value=display_name)
                for i in range(2, TEMPLATE_FORMULA_ROWS + 2):
                    formula = (
                        f'=IFERROR(IF(${ref_col}{i}="","",'
                        f"INDEX(Departments!$B:$B,"
                        f"MATCH(${ref_col}{i},Departments!$A:$A,0))),\"\")"
                    )
                    ws.cell(row=i, column=display_idx, value=formula).fill = ro_fill
                total_columns = display_idx
                all_names.append(display_name)

            for cell in ws[1]:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(
                    horizontal="center", vertical="center"
                )

            ws.freeze_panes = "A2"
            ws.auto_filter.ref = (
                f"A1:{ws.cell(row=1, column=total_columns).coordinate}"
            )

            for col_idx, col_name in enumerate(all_names, start=1):
                ws.column_dimensions[
                    ws.cell(row=1, column=col_idx).column_letter
                ].width = max(12, len(col_name) + 4)

            self._add_template_validations(ws, columns, sheet_name)

        self._write_department_list_sheet(wb)

        instructions = wb.create_sheet("Instructions")
        self._write_instructions_sheet(
            instructions, header_fill, header_font, section_fill, section_font
        )

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf.read()

    def generate_template_csv_zip(self) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for sheet_name in TEMPLATE_ALL_SHEETS:
                # Header rows only (no sample data). Input columns only: the
                # formula display columns exist only in the XLSX template.
                columns = TEMPLATE_COLUMNS[sheet_name]
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(columns)
                zf.writestr(f"{sheet_name}.csv", output.getvalue())

            zf.writestr(
                "Instructions.txt", self._template_instructions_text()
            )
        buf.seek(0)
        return buf.read()

    @staticmethod
    def _add_department_dropdown(ws, columns: list[str]):
        """List validation fed by the hidden _Lists sheet.

        Only department ids that exist in the database appear in the
        dropdown; the generous fixed range keeps working as departments are
        added without regenerating the template.
        """
        col_idx = columns.index("department_id") + 1
        col_letter = ws.cell(row=1, column=col_idx).column_letter
        dv = DataValidation(
            type="list",
            formula1=DEPT_DROPDOWN_FORMULA,
            allow_blank=True,
            showErrorMessage=True,
        )
        dv.errorTitle = "Invalid department id"
        dv.error = (
            "Pick a department id from the dropdown (fed by the hidden "
            "_Lists sheet) or leave the cell blank."
        )
        dv.add(f"{col_letter}2:{col_letter}{TEMPLATE_FORMULA_ROWS + 1}")
        ws.add_data_validation(dv)

    @staticmethod
    def _add_positive_int_validation(
        ws,
        columns: list[str],
        field_name: str,
        title: str,
        message: str,
    ):
        col_idx = columns.index(field_name) + 1
        col_letter = ws.cell(row=1, column=col_idx).column_letter
        dv = DataValidation(
            type="whole",
            operator="greaterThan",
            formula1="0",
            allow_blank=True,
            showErrorMessage=True,
        )
        dv.error = message
        dv.errorTitle = title
        dv.add(f"{col_letter}2:{col_letter}200")
        ws.add_data_validation(dv)

    def _add_template_validations(
        self, ws, columns: list[str], sheet_name: str
    ):
        # Validations only cover the 5 template sheets; legacy sheets
        # (Meetings/Availability/BusyBlocks) are validated on upload.
        if sheet_name == "Rooms":
            self._add_positive_int_validation(
                ws,
                columns,
                "capacity",
                "Invalid capacity",
                "Capacity must be a positive integer.",
            )
            self._add_department_dropdown(ws, columns)

        if sheet_name == "Sections":
            self._add_positive_int_validation(
                ws,
                columns,
                "headcount",
                "Invalid headcount",
                "Headcount must be a positive integer.",
            )

        if sheet_name == "Subjects":
            self._add_positive_int_validation(
                ws,
                columns,
                "units",
                "Invalid units",
                "Units must be a positive integer.",
            )

        if sheet_name == "ProfessorPreferences":
            self._add_positive_int_validation(
                ws,
                columns,
                "priority",
                "Invalid priority",
                "Priority must be a positive integer.",
            )

        if sheet_name == "Professors":
            self._add_department_dropdown(ws, columns)
            self._add_positive_int_validation(
                ws,
                columns,
                "max_hours",
                "Invalid daily hours",
                "Max daily hours must be a positive integer.",
            )
            self._add_positive_int_validation(
                ws,
                columns,
                "max_consecutive",
                "Invalid consecutive limit",
                "Max consecutive slots must be a positive integer.",
            )

    def _write_instructions_sheet(
        self,
        ws,
        header_fill,
        header_font,
        section_fill,
        section_font,
    ):
        ws.column_dimensions["A"].width = 18
        ws.column_dimensions["B"].width = 22
        ws.column_dimensions["C"].width = 12
        ws.column_dimensions["D"].width = 95
        ws.sheet_view.showGridLines = False

        row = 1
        ws.cell(
            row=row,
            column=1,
            value="Schedule Import Template - CvSU Imus",
        ).font = Font(bold=True, size=14, color="1B5E20")
        ws.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=4
        )

        row += 2
        intro_lines = [
            "Use this workbook as a starting point. Every sheet is header-only: type your data starting in row 2.",
            "Departments, rooms, subjects, sections, and professors. The hidden _Lists sheet feeds the department_id dropdowns on Rooms and Professors.",
            "Sheet order (the importer processes sheets in this order): "
            + " -> ".join(TEMPLATE_ALL_SHEETS),
            "Legacy 9-sheet workbooks that also include Assignments, Meetings, Availability, and BusyBlocks sheets are still accepted on upload.",
        ]
        for line in intro_lines:
            cell = ws.cell(row=row, column=1, value=line)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(
                start_row=row,
                start_column=1,
                end_row=row,
                end_column=4,
            )
            row += 1

        row += 1
        cell = ws.cell(row=row, column=1, value="General rules")
        cell.font = section_font
        cell.fill = section_fill
        ws.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=4
        )
        row += 1

        for note in TEMPLATE_GENERAL_NOTES:
            cell = ws.cell(row=row, column=1, value=f"- {note}")
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(
                start_row=row,
                start_column=1,
                end_row=row,
                end_column=4,
            )
            row += 1

        row += 1
        cell = ws.cell(row=row, column=1, value="Column guide")
        cell.font = section_font
        cell.fill = section_fill
        ws.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=4
        )
        row += 1

        guide_headers = [
            "Sheet",
            "Column",
            "Required?",
            "Description / Allowed values",
        ]
        for col_idx, value in enumerate(guide_headers, start=1):
            header_cell = ws.cell(row=row, column=col_idx, value=value)
            header_cell.font = header_font
            header_cell.fill = header_fill
            header_cell.alignment = Alignment(vertical="center")
        row += 1

        for sheet_name in TEMPLATE_ALL_SHEETS:
            for col_name, required, description in TEMPLATE_COLUMN_GUIDE[
                sheet_name
            ]:
                ws.cell(row=row, column=1, value=sheet_name)
                ws.cell(row=row, column=2, value=col_name)
                ws.cell(row=row, column=3, value=required)
                description_cell = ws.cell(
                    row=row, column=4, value=description
                )
                description_cell.alignment = Alignment(
                    wrap_text=True, vertical="top"
                )
                row += 1

    def _template_instructions_text(self) -> str:
        lines = [
            "Schedule Import Template - CvSU Imus",
            "",
            "CSV bundle: this ZIP contains one CSV file per sheet, headers only. A single .csv upload is not supported.",
            "Keep the exact file names: "
            + ", ".join(f"{name}.csv" for name in TEMPLATE_ALL_SHEETS)
            + ".",
            "Row 1 is the header row; data starts in row 2.",
            "Sheet order: "
            + " -> ".join(TEMPLATE_ALL_SHEETS),
            "Legacy 9-sheet workbooks (Assignments/Meetings/Availability/BusyBlocks sheets) are still accepted on upload.",
            "",
            "General rules:",
        ]
        lines.extend(f"- {note}" for note in TEMPLATE_GENERAL_NOTES)
        lines.extend(["", "Column guide:"])

        for sheet_name in TEMPLATE_ALL_SHEETS:
            lines.extend(["", f"[{sheet_name}]"])
            for col_name, required, description in TEMPLATE_COLUMN_GUIDE[
                sheet_name
            ]:
                lines.append(
                    f"- {col_name} ({required}): {description}"
                )

        return "\n".join(lines) + "\n"


processor = ImportProcessor()