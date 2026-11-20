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


SHEET_MODELS = [
    "Departments",
    "Rooms",
    "Subjects",
    "Sections",
    "Professors",
    "Assignments",
    "Meetings",
    "Availability",
    "BusyBlocks",
]

REQUIRED_COLUMNS = {
    "Departments": ["name"],
    "Rooms": ["name", "capacity"],
    "Subjects": ["code", "title"],
    "Sections": ["name", "headcount"],
    "Professors": ["user_id"],
    "Assignments": ["professor_id", "subject_id", "section_id"],
    "Meetings": ["assignment_id", "order", "mode"],
    "Availability": ["professor_id", "day", "start_time", "end_time"],
    "BusyBlocks": ["professor_id", "day", "start_time", "end_time"],
}

OPTIONAL_COLUMNS = {
    "Departments": [],
    "Rooms": ["department_id"],
    "Subjects": ["units"],
    "Sections": [],
    "Professors": ["department_id", "max_daily_hours", "max_consecutive"],
    "Assignments": ["term_id"],
    "Meetings": ["duration_slots"],
    "Availability": ["is_preferred"],
    "BusyBlocks": [],
}

ALL_COLUMNS = {k: REQUIRED_COLUMNS[k] + OPTIONAL_COLUMNS[k] for k in SHEET_MODELS}

VALID_MODES = {"async", "sync", "lab"}
VALID_DAYS = {0, 1, 2, 3, 4, 5}
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# The import parser accepts an optional "id" column on every sheet so existing
# records can be updated. Include it in downloaded templates even though it is
# not part of ALL_COLUMNS (which drives validation, not the workbook layout).
TEMPLATE_COLUMNS = {name: ["id", *ALL_COLUMNS[name]] for name in SHEET_MODELS}

# Realistic CvSU - Imus (Computer Science) sample rows. Sample ids are
# deliberately high so they are easy to replace; cross-references must stay
# consistent because validation checks them before committing.
TEMPLATE_SAMPLE_ROWS = {
    "Departments": [
        {"id": 9001, "name": "Department of Computer Science"},
        {"id": 9002, "name": "Department of Information Technology"},
    ],
    "Rooms": [
        {
            "id": 9101,
            "name": "CS Lecture Room 1",
            "capacity": 50,
            "department_id": 9001,
        },
        {
            "id": 9102,
            "name": "CS Computer Laboratory 1",
            "capacity": 40,
            "department_id": 9001,
        },
        {
            "id": 9103,
            "name": "CS Computer Laboratory 2",
            "capacity": 35,
            "department_id": 9001,
        },
        {
            "id": 9104,
            "name": "IT Lecture Room 1",
            "capacity": 45,
            "department_id": 9002,
        },
    ],
    "Subjects": [
        {"id": 9201, "code": "CS 101", "title": "Introduction to Computing", "units": 3},
        {"id": 9202, "code": "CS 102", "title": "Computer Programming 1", "units": 3},
        {
            "id": 9203,
            "code": "CS 201",
            "title": "Data Structures and Algorithms",
            "units": 3,
        },
        {"id": 9204, "code": "CS 301", "title": "Operating Systems", "units": 3},
        {
            "id": 9205,
            "code": "CS 302",
            "title": "Database Management Systems",
            "units": 3,
        },
        {"id": 9206, "code": "CS 401", "title": "Software Engineering", "units": 3},
    ],
    "Sections": [
        {"id": 9301, "name": "BSCS 3-A", "headcount": 40},
        {"id": 9302, "name": "BSCS 3-B", "headcount": 38},
        {"id": 9303, "name": "BSCS 2-A", "headcount": 42},
    ],
    "Professors": [
        {
            "id": 9501,
            "user_id": 1,
            "department_id": 9001,
            "max_daily_hours": 8,
            "max_consecutive": 4,
        },
        {
            "id": 9502,
            "user_id": 2,
            "department_id": 9001,
            "max_daily_hours": 8,
            "max_consecutive": 4,
        },
    ],
    "Assignments": [
        {
            "id": 9401,
            "professor_id": 9501,
            "subject_id": 9203,
            "section_id": 9301,
        },
        {
            "id": 9402,
            "professor_id": 9501,
            "subject_id": 9205,
            "section_id": 9301,
        },
        {
            "id": 9403,
            "professor_id": 9502,
            "subject_id": 9204,
            "section_id": 9302,
        },
        {
            "id": 9404,
            "professor_id": 9502,
            "subject_id": 9206,
            "section_id": 9303,
        },
    ],
    "Meetings": [
        {
            "id": 9601,
            "assignment_id": 9401,
            "order": 1,
            "mode": "sync",
            "duration_slots": 2,
        },
        {
            "id": 9602,
            "assignment_id": 9401,
            "order": 2,
            "mode": "lab",
            "duration_slots": 3,
        },
        {
            "id": 9603,
            "assignment_id": 9402,
            "order": 1,
            "mode": "sync",
            "duration_slots": 2,
        },
        {
            "id": 9604,
            "assignment_id": 9403,
            "order": 1,
            "mode": "lab",
            "duration_slots": 3,
        },
        {
            "id": 9605,
            "assignment_id": 9403,
            "order": 2,
            "mode": "async",
            "duration_slots": 1,
        },
        {
            "id": 9606,
            "assignment_id": 9404,
            "order": 1,
            "mode": "sync",
            "duration_slots": 2,
        },
    ],
    "Availability": [
        {
            "id": 9701,
            "professor_id": 9501,
            "day": 0,
            "start_time": "08:00",
            "end_time": "17:00",
            "is_preferred": True,
        },
        {
            "id": 9702,
            "professor_id": 9501,
            "day": 2,
            "start_time": "08:00",
            "end_time": "17:00",
            "is_preferred": False,
        },
        {
            "id": 9703,
            "professor_id": 9502,
            "day": 1,
            "start_time": "08:00",
            "end_time": "17:00",
            "is_preferred": True,
        },
        {
            "id": 9704,
            "professor_id": 9502,
            "day": 3,
            "start_time": "08:00",
            "end_time": "17:00",
            "is_preferred": False,
        },
    ],
    "BusyBlocks": [
        {
            "id": 9801,
            "professor_id": 9501,
            "day": 4,
            "start_time": "13:00",
            "end_time": "15:00",
        },
        {
            "id": 9802,
            "professor_id": 9502,
            "day": 5,
            "start_time": "09:00",
            "end_time": "11:00",
        },
    ],
}

# One row per column so the Instructions tab explains the entire schema.
TEMPLATE_COLUMN_GUIDE = {
    "Departments": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("name", "Required", "Unique department name (max 100 characters). Sample: Department of Computer Science."),
    ],
    "Rooms": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("name", "Required", "Unique room name (max 50 characters). Samples: CS Lecture Room 1, CS Computer Laboratory 1."),
        ("capacity", "Required", "Positive integer seat capacity."),
        ("department_id", "Optional", "Integer id from the Departments sheet."),
    ],
    "Subjects": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("code", "Required", "Unique subject code (max 20 characters). Sample: CS 201."),
        ("title", "Required", "Subject title (max 200 characters)."),
        ("units", "Optional", "Positive integer; defaults to 3."),
    ],
    "Sections": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("name", "Required", "Unique section name (max 50 characters). Sample: BSCS 3-A."),
        ("headcount", "Required", "Positive integer number of students."),
    ],
    "Professors": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("user_id", "Required", "Integer id of an existing auth user (not the professor profile id). Replace the sample values with real user ids."),
        ("department_id", "Optional", "Integer id from the Departments sheet."),
        ("max_daily_hours", "Optional", "Positive integer; defaults to 8."),
        ("max_consecutive", "Optional", "Positive integer; defaults to 4."),
    ],
    "Assignments": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("professor_id", "Required", "Integer id from the Professors sheet."),
        ("subject_id", "Required", "Integer id from the Subjects sheet."),
        ("section_id", "Required", "Integer id from the Sections sheet."),
        ("term_id", "Optional", "Integer id of an existing AcademicTerm. Leave blank if not term-specific."),
    ],
    "Meetings": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("assignment_id", "Required", "Integer id from the Assignments sheet."),
        ("order", "Required", "Integer >= 1; must be unique per assignment."),
        ("mode", "Required", "Allowed values: async, sync, lab (lowercase)."),
        ("duration_slots", "Optional", "Integer >= 1; defaults to 1."),
    ],
    "Availability": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("professor_id", "Required", "Integer id from the Professors sheet."),
        ("day", "Required", "0-5 or a day name. 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday."),
        ("start_time", "Required", "24-hour time in HH:MM format, e.g., 08:00."),
        ("end_time", "Required", "24-hour time in HH:MM format; must be after start_time."),
        ("is_preferred", "Optional", "true/false (also accepts 1/0, yes/no); defaults to false."),
    ],
    "BusyBlocks": [
        ("id", "Optional", "Integer primary key. Leave blank to create; provide an existing id to update."),
        ("professor_id", "Required", "Integer id from the Professors sheet."),
        ("day", "Required", "0-5 or a day name. 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday."),
        ("start_time", "Required", "24-hour time in HH:MM format, e.g., 09:00."),
        ("end_time", "Required", "24-hour time in HH:MM format; must be after start_time."),
    ],
}

TEMPLATE_GENERAL_NOTES = [
    "XLSX: use the exact sheet names below. Row 1 is the header row; data starts in row 2.",
    "CSV: upload a .zip containing one .csv per sheet (Departments.csv, Rooms.csv, ..., BusyBlocks.csv). A single .csv file is not supported.",
    "Leave 'id' blank to create a new record. Provide an existing id to update that record.",
    "Foreign-key values must reference ids defined in the same workbook: department_id, professor_id, subject_id, section_id, assignment_id.",
    "Every assignment must have at least one synchronous meeting: mode 'sync' or 'lab'.",
    "Delivery modes: async, sync, lab. Day values: 0-5 or Monday-Saturday. Times: 24-hour HH:MM.",
    "Capacity, headcount, units, max_daily_hours, max_consecutive, order, and duration_slots must be positive integers.",
    "Rooms have no room-type column. Use descriptive names such as 'CS Lecture Room 1' or 'CS Computer Laboratory 1'.",
    "The sample professor user_id values (1 and 2) are placeholders. Replace them with existing auth user ids before importing.",
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

    def _parse_xlsx(self, file) -> dict[str, list[dict]]:
        wb = load_workbook(file, data_only=True)
        result = {}
        for sheet_name in SHEET_MODELS:
            if sheet_name not in wb.sheetnames:
                result[sheet_name] = []
                continue
            ws = wb[sheet_name]
            rows = []
            headers = None
            for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
                if i == 1:
                    headers = [str(c).strip() if c else "" for c in row]
                    continue
                if not any(v is not None and v != "" for v in row):
                    continue
                row_dict = {}
                for j, val in enumerate(row):
                    if j < len(headers) and headers[j]:
                        row_dict[headers[j]] = val
                row_dict["_row_num"] = i
                rows.append(row_dict)
            result[sheet_name] = rows
        return result

    def _parse_csv_zip(self, file) -> dict[str, list[dict]]:
        result = {name: [] for name in SHEET_MODELS}
        with zipfile.ZipFile(file, "r") as zf:
            for sheet_name in SHEET_MODELS:
                csv_name = f"{sheet_name}.csv"
                if csv_name not in zf.namelist():
                    continue
                with zf.open(csv_name) as cf:
                    content = cf.read().decode("utf-8-sig")
                    reader = csv.DictReader(io.StringIO(content))
                    for i, row in enumerate(reader, start=2):
                        if not any(v is not None and v != "" for v in row.values()):
                            continue
                        row = {k.strip(): v for k, v in row.items() if k}
                        row["_row_num"] = i
                        result[sheet_name].append(row)
        return result

    def validate_all(self, parsed_data: dict[str, list[dict]]) -> ImportResult:
        result = ImportResult(valid=True, preview_token=str(uuid4()), parsed_data=parsed_data)
        self._validate_structure(parsed_data, result)
        if not result.valid:
            return result
        self._validate_rows(parsed_data, result)
        self._validate_cross_model(parsed_data, result)
        self._compute_summary(parsed_data, result)
        if result.valid:
            cache.set(f"import_preview_{result.preview_token}", parsed_data, self.PREVIEW_TTL)
        return result

    def _validate_structure(self, parsed_data: dict, result: ImportResult):
        for sheet_name in SHEET_MODELS:
            if sheet_name not in parsed_data:
                result.valid = False
                result.errors.append(ImportError(sheet_name, 0, "sheet", f"Missing sheet: {sheet_name}"))

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
                for col, val in row.items():
                    if col == "_row_num" or col not in all_cols:
                        continue
                    if sheet_name == "Rooms" and col == "capacity":
                        ival = parse_int(val)
                        if ival is None or ival <= 0:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Capacity must be positive integer"))
                    elif sheet_name == "Subjects" and col == "units":
                        ival = parse_int(val)
                        if ival is not None and ival <= 0:
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
                    elif sheet_name == "Professors" and col in ("max_daily_hours", "max_consecutive"):
                        ival = parse_int(val)
                        if ival is not None and ival < 1:
                            result.valid = False
                            result.errors.append(ImportError(sheet_name, row_num, col, "Must be positive integer"))

    def _validate_cross_model(self, parsed_data: dict, result: ImportResult):
        dept_ids = {r.get("id") for r in parsed_data.get("Departments", []) if r.get("id")}
        room_names = {r.get("name") for r in parsed_data.get("Rooms", []) if r.get("name")}
        subject_codes = {r.get("code") for r in parsed_data.get("Subjects", []) if r.get("code")}
        section_names = {r.get("name") for r in parsed_data.get("Sections", []) if r.get("name")}
        prof_ids = {r.get("id") for r in parsed_data.get("Professors", []) if r.get("id")}
        prof_user_ids = {r.get("user_id") for r in parsed_data.get("Professors", []) if r.get("user_id")}
        assignment_ids = {r.get("id") for r in parsed_data.get("Assignments", []) if r.get("id")}
        assignment_keys = set()

        # Validate professor user_ids exist in database
        from django.contrib.auth import get_user_model
        User = get_user_model()
        existing_user_ids = set(User.objects.filter(id__in=prof_user_ids).values_list("id", flat=True))
        for row in parsed_data.get("Professors", []):
            user_id = row.get("user_id")
            if user_id and int(user_id) not in existing_user_ids:
                result.valid = False
                result.errors.append(ImportError("Professors", row.get("_row_num", 0), "user_id", f"User {user_id} does not exist"))

        for row in parsed_data.get("Rooms", []):
            did = row.get("department_id")
            if did and did not in dept_ids:
                result.valid = False
                result.errors.append(ImportError("Rooms", row.get("_row_num", 0), "department_id", f"Department {did} not found"))

        for row in parsed_data.get("Professors", []):
            did = row.get("department_id")
            if did and did not in dept_ids:
                result.valid = False
                result.errors.append(ImportError("Professors", row.get("_row_num", 0), "department_id", f"Department {did} not found"))

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
            "Professors": ["user_id", "department_id", "max_daily_hours", "max_consecutive"],
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

            for row in parsed_data.get(sheet_name, []):
                row_num = row.get("_row_num", 0)
                row_errors = error_lookup.get((sheet_name, row_num), [])

                if row_errors:
                    action = "error"
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

    def commit(self, preview_token: str, selected_keys: list[str] | None = None) -> CommitResult:
        parsed_data = cache.get(f"import_preview_{preview_token}")
        if not parsed_data:
            return CommitResult(committed=False, errors=[{"message": "Preview token expired or invalid"}])

        if selected_keys is not None:
            selected = set(selected_keys)
            parsed_data = {
                sheet: [
                    row
                    for row in rows
                    if f"{sheet}:{row.get('_row_num', 0)}" in selected
                ]
                for sheet, rows in parsed_data.items()
            }

        result = CommitResult(committed=True)
        try:
            from django.db import transaction
            from catalog.models import Department, Room, Subject, Section
            from users.models import Professors
            from timetable.models import Assignment, MeetingSlot, AvailabilityWindow, BusyBlock
            from django.contrib.auth import get_user_model

            User = get_user_model()

            with transaction.atomic():
                # Departments
                for row in parsed_data.get("Departments", []):
                    pk = row.get("id")
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
                    defaults = {
                        "name": row["name"],
                        "headcount": parse_int(row["headcount"]),
                        "term_id": parse_int(row.get("term_id")) or None,
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
                    pk = row.get("id")
                    user_id = parse_int(row["user_id"])
                    if not User.objects.filter(id=user_id).exists():
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
                        obj = Professors.objects.create(**defaults)
                        created = True
                    if created:
                        result.summary["creates"] += 1
                    else:
                        result.summary["updates"] += 1

                # Assignments
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

    def generate_template_xlsx(self) -> bytes:
        wb = Workbook()
        header_fill = PatternFill("solid", fgColor="1E7145")
        header_font = Font(bold=True, color="FFFFFF")
        section_fill = PatternFill("solid", fgColor="E8F5E9")
        section_font = Font(bold=True, color="1B5E20")

        for sheet_name in SHEET_MODELS:
            if sheet_name == SHEET_MODELS[0]:
                ws = wb.active
                ws.title = sheet_name
            else:
                ws = wb.create_sheet(sheet_name)

            columns = TEMPLATE_COLUMNS[sheet_name]
            ws.append(columns)

            for sample in TEMPLATE_SAMPLE_ROWS.get(sheet_name, []):
                ws.append([sample.get(col, "") for col in columns])

            for cell in ws[1]:
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(
                    horizontal="center", vertical="center"
                )

            ws.freeze_panes = "A2"
            ws.auto_filter.ref = (
                f"A1:{ws.cell(row=1, column=len(columns)).coordinate}"
            )

            for col_idx, col_name in enumerate(columns, start=1):
                ws.column_dimensions[
                    ws.cell(row=1, column=col_idx).column_letter
                ].width = max(12, len(col_name) + 4)

            self._add_template_validations(ws, columns, sheet_name)

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
            for sheet_name in SHEET_MODELS:
                columns = TEMPLATE_COLUMNS[sheet_name]
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(columns)
                for sample in TEMPLATE_SAMPLE_ROWS.get(sheet_name, []):
                    writer.writerow(
                        [sample.get(col, "") for col in columns]
                    )
                zf.writestr(f"{sheet_name}.csv", output.getvalue())

            zf.writestr(
                "Instructions.txt", self._template_instructions_text()
            )
        buf.seek(0)
        return buf.read()

    @staticmethod
    def _add_list_validation(
        ws,
        columns: list[str],
        field_name: str,
        values: str,
        title: str,
        message: str,
    ):
        col_idx = columns.index(field_name) + 1
        col_letter = ws.cell(row=1, column=col_idx).column_letter
        dv = DataValidation(
            type="list",
            formula1=f'"{values}"',
            allow_blank=True,
            showErrorMessage=True,
        )
        dv.error = message
        dv.errorTitle = title
        dv.add(f"{col_letter}2:{col_letter}200")
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
        if sheet_name == "Meetings":
            self._add_list_validation(
                ws,
                columns,
                "mode",
                "async,sync,lab",
                "Invalid delivery mode",
                "Mode must be async, sync, or lab.",
            )
            self._add_positive_int_validation(
                ws,
                columns,
                "order",
                "Invalid meeting order",
                "Order must be a positive integer.",
            )
            self._add_positive_int_validation(
                ws,
                columns,
                "duration_slots",
                "Invalid duration",
                "Duration slots must be a positive integer.",
            )

        if sheet_name in ("Availability", "BusyBlocks"):
            self._add_list_validation(
                ws,
                columns,
                "day",
                "0,1,2,3,4,5",
                "Invalid day",
                "Day must be 0-5 (Monday-Saturday).",
            )

        if sheet_name == "Availability":
            self._add_list_validation(
                ws,
                columns,
                "is_preferred",
                "true,false",
                "Invalid preference",
                "is_preferred must be true or false.",
            )

        if sheet_name == "Rooms":
            self._add_positive_int_validation(
                ws,
                columns,
                "capacity",
                "Invalid capacity",
                "Capacity must be a positive integer.",
            )

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

        if sheet_name == "Professors":
            self._add_positive_int_validation(
                ws,
                columns,
                "max_daily_hours",
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
            value=(
                "Schedule Import Template - CvSU Imus "
                "(Computer Science sample)"
            ),
        ).font = Font(bold=True, size=14, color="1B5E20")
        ws.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=4
        )

        row += 2
        intro_lines = [
            "Use this workbook as a starting point. Rows below each header contain realistic CvSU-Imus Computer Science examples:",
            "Departments, lecture/laboratory rooms, CS subjects, BSCS sections, professors, assignments, meetings, availability, and busy blocks.",
            "Replace or extend the sample rows with your own data. Leave 'id' blank to create new records.",
            "Sheet order (the importer processes sheets in this order): "
            + " -> ".join(SHEET_MODELS),
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

        for sheet_name in SHEET_MODELS:
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
            "Schedule Import Template - CvSU Imus (Computer Science sample)",
            "",
            "CSV bundle: this ZIP contains one CSV file per sheet. A single .csv upload is not supported.",
            "Keep the exact file names: "
            + ", ".join(f"{name}.csv" for name in SHEET_MODELS)
            + ".",
            "Row 1 is the header row; data starts in row 2.",
            "Sheet order: "
            + " -> ".join(SHEET_MODELS),
            "",
            "General rules:",
        ]
        lines.extend(f"- {note}" for note in TEMPLATE_GENERAL_NOTES)
        lines.extend(["", "Column guide:"])

        for sheet_name in SHEET_MODELS:
            lines.extend(["", f"[{sheet_name}]"])
            for col_name, required, description in TEMPLATE_COLUMN_GUIDE[
                sheet_name
            ]:
                lines.append(
                    f"- {col_name} ({required}): {description}"
                )

        return "\n".join(lines) + "\n"


processor = ImportProcessor()