import csv
import io
import zipfile
from dataclasses import dataclass, field
from datetime import time
from typing import Any
from uuid import uuid4

from openpyxl import Workbook, load_workbook
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
    "Assignments": [],
    "Meetings": ["duration_slots"],
    "Availability": ["is_preferred"],
    "BusyBlocks": [],
}

ALL_COLUMNS = {k: REQUIRED_COLUMNS[k] + OPTIONAL_COLUMNS[k] for k in SHEET_MODELS}

VALID_MODES = {"async", "sync", "lab"}
VALID_DAYS = {0, 1, 2, 3, 4, 5}
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


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

        for sheet_name, (model, pk_field) in model_map.items():
            creates = 0
            updates = 0
            for row in parsed_data.get(sheet_name, []):
                pk_val = row.get(pk_field)
                if pk_val:
                    exists = model.objects.filter(**{pk_field: pk_val}).exists()
                    if exists:
                        updates += 1
                    else:
                        creates += 1
                else:
                    creates += 1
            result.summary["creates"] += creates
            result.summary["updates"] += updates
            if creates or updates:
                result.details.append({"model": sheet_name, "action": "create" if creates else "update", "count": creates + updates})

    def commit(self, preview_token: str) -> CommitResult:
        parsed_data = cache.get(f"import_preview_{preview_token}")
        if not parsed_data:
            return CommitResult(committed=False, errors=[{"message": "Preview token expired or invalid"}])

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
                        "professor_id": parse_int(row["professor_id"]),
                        "subject_id": parse_int(row["subject_id"]),
                        "section_id": parse_int(row["section_id"]),
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
                for row in parsed_data.get("Meetings", []):
                    pk = row.get("id")
                    defaults = {
                        "assignment_id": parse_int(row["assignment_id"]),
                        "order": parse_int(row["order"]),
                        "mode": parse_mode(row["mode"]),
                        "duration_slots": parse_int(row.get("duration_slots")) or 1,
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
                        "professor_id": parse_int(row["professor_id"]),
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
                        "professor_id": parse_int(row["professor_id"]),
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
        for sheet_name in SHEET_MODELS:
            if sheet_name == "Departments":
                ws = wb.active
                ws.title = sheet_name
            else:
                ws = wb.create_sheet(sheet_name)

            columns = ALL_COLUMNS[sheet_name]
            for col_idx, col_name in enumerate(columns, start=1):
                ws.cell(row=1, column=col_idx, value=col_name)

            example_row = self._get_example_row(sheet_name)
            for col_idx, val in enumerate(example_row, start=1):
                ws.cell(row=2, column=col_idx, value=val)

            for col_idx in range(1, len(columns) + 1):
                ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = max(15, len(columns[col_idx-1]) + 2)

            if sheet_name == "Meetings":
                dv = DataValidation(type="list", formula1='"async,sync,lab"', allow_blank=True)
                dv.error = "Invalid mode"
                dv.errorTitle = "Mode must be async, sync, or lab"
                mode_col_idx = columns.index("mode") + 1
                dv.add(ws.cell(row=2, column=mode_col_idx))
                ws.add_data_validation(dv)

            if sheet_name in ("Availability", "BusyBlocks"):
                dv = DataValidation(type="list", formula1='"0,1,2,3,4,5"', allow_blank=True)
                dv.error = "Invalid day"
                dv.errorTitle = "Day must be 0-5 (Mon-Sat)"
                day_col_idx = columns.index("day") + 1
                dv.add(ws.cell(row=2, column=day_col_idx))
                ws.add_data_validation(dv)

        instructions = wb.create_sheet("Instructions")
        instructions.append(["Schedule Import Template"])
        instructions.append([])
        instructions.append(["This file contains sheets for each data model."])
        instructions.append(["Fill in the data starting from row 2."])
        instructions.append(["Leave 'id' blank to create new records; provide 'id' to update existing."])
        instructions.append([])
        instructions.append(["Sheet Order (import processes in this order):"])
        for i, name in enumerate(SHEET_MODELS, 1):
            instructions.append([f"{i}. {name}"])
        instructions.append([])
        instructions.append(["Key Fields:"])
        instructions.append(["- Departments: id, name"])
        instructions.append(["- Rooms: id, name, capacity, department_id (optional)"])
        instructions.append(["- Subjects: id, code (unique), title, units (optional, default 3)"])
        instructions.append(["- Sections: id, name (unique), headcount"])
        instructions.append(["- Professors: id, user_id (must exist), department_id, max_daily_hours, max_consecutive"])
        instructions.append(["- Assignments: id, professor_id, subject_id, section_id"])
        instructions.append(["- Meetings: id, assignment_id, order, mode (async/sync/lab), duration_slots (optional)"])
        instructions.append(["- Availability: id, professor_id, day (0-5), start_time (HH:MM), end_time (HH:MM), is_preferred"])
        instructions.append(["- BusyBlocks: id, professor_id, day (0-5), start_time (HH:MM), end_time (HH:MM)"])
        instructions.append([])
        instructions.append(["Time Format: HH:MM (24-hour, e.g., 08:30, 13:45)"])
        instructions.append(["Day Values: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf.read()

    def generate_template_csv_zip(self) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for sheet_name in SHEET_MODELS:
                columns = ALL_COLUMNS[sheet_name]
                example = self._get_example_row(sheet_name)
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(columns)
                writer.writerow(example)
                zf.writestr(f"{sheet_name}.csv", output.getvalue())

            instructions = (
                "Schedule Import Template (CSV)\n\n"
                "This ZIP contains one CSV file per data model.\n"
                "Fill in data starting from row 2.\n"
                "Leave 'id' blank to create new records; provide 'id' to update existing.\n\n"
                "Sheet Order (import processes in this order):\n"
                + "\n".join(f"{i}. {name}" for i, name in enumerate(SHEET_MODELS, 1))
                + "\n\n"
                "Time Format: HH:MM (24-hour)\n"
                "Day Values: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday\n"
                "Mode Values: async, sync, lab\n"
            )
            zf.writestr("Instructions.txt", instructions)
        buf.seek(0)
        return buf.read()

    def _get_example_row(self, sheet_name: str) -> list:
        examples = {
            "Departments": [1, "CS"],
            "Rooms": [1, "R101", 40, 1],
            "Subjects": [1, "CS101", "Introduction to Programming", 3],
            "Sections": [1, "CS-1A", 35],
            "Professors": [1, 2, 1, 8, 4],
            "Assignments": [1, 1, 1, 1],
            "Meetings": [1, 1, 1, "sync", 2],
            "Availability": [1, 1, 0, "08:00", "12:00", True],
            "BusyBlocks": [1, 1, 2, "13:00", "15:00"],
        }
        cols = ALL_COLUMNS[sheet_name]
        ex = examples.get(sheet_name, [])
        return [ex[cols.index(c)] if c in ex else "" for c in cols]


processor = ImportProcessor()