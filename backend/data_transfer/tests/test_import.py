import io
import csv
import zipfile
from io import BytesIO
from datetime import date, time as dtime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from openpyxl import load_workbook
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import Department, Room, Section, Subject
from timetable.models import (
    AcademicTerm,
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    GlobalSettings,
    MeetingSlot,
)
from users.models import (
    PreferenceSubmission,
    ProfessorPreference,
    Professors,
    SubmissionItem,
)

from data_transfer.import_utils import (
    TEMPLATE_SHEETS,
    build_preference_meetings,
    parse_days,
    processor,
    parse_time,
    parse_day,
    parse_mode,
)
from data_transfer.models import ImportBatch

User = get_user_model()


class ImportTestCase(APITestCase):
    def setUp(self):
        self.registrar = User.objects.create_user(
            username="reg", password="pass12345", is_staff=True
        )
        self.reg_token = Token.objects.create(user=self.registrar)

        self.prof_user = User.objects.create_user(username="prof1", password="pass12345")
        self.prof_user2 = User.objects.create_user(username="prof2", password="pass12345")
        self.dept = Department.objects.create(name="CS")
        self.prof = Professors.objects.create(user=self.prof_user, department=self.dept)
        self.prof2 = Professors.objects.create(user=self.prof_user2, department=self.dept)

        self.subject = Subject.objects.create(code="CS101", title="Intro", units=3)
        self.section = Section.objects.create(name="BSIT-3A", headcount=30)
        self.room = Room.objects.create(name="R101", capacity=40, department=self.dept)
        self.assignment = Assignment.objects.create(prof=self.prof, subject=self.subject, section=self.section)

        self.url_preview = "/api/imports/preview/"
        self.url_commit = "/api/imports/commit/"
        self.url_template = "/api/imports/template/"
        self.url_template_csv = "/api/imports/template/csv/"
        self.url_data_transfer_template = "/api/data-transfer/template/"

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def _make_xlsx(self, sheets_data: dict) -> BytesIO:
        """Create an XLSX file in memory from sheets data."""
        from openpyxl import Workbook
        wb = Workbook()
        first = True
        for sheet_name, rows in sheets_data.items():
            if first:
                ws = wb.active
                ws.title = sheet_name
                first = False
            else:
                ws = wb.create_sheet(sheet_name)
            for row_idx, row in enumerate(rows, start=1):
                for col_idx, val in enumerate(row, start=1):
                    ws.cell(row=row_idx, column=col_idx, value=val)
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        buf.name = "test.xlsx"
        return buf

    def _make_csv_zip(self, sheets_data: dict) -> BytesIO:
        """Create a CSV ZIP file in memory from sheets data."""
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for sheet_name, rows in sheets_data.items():
                output = io.StringIO()
                writer = csv.writer(output)
                for row in rows:
                    writer.writerow(row)
                zf.writestr(f"{sheet_name}.csv", output.getvalue())
        buf.seek(0)
        return buf


class ImportPreviewTests(ImportTestCase):
    def test_unauthenticated_rejected(self):
        response = self.client.post(self.url_preview, {"file": b"test"}, format="multipart")
        self.assertEqual(response.status_code, 401)

    def test_professor_forbidden(self):
        self.auth(Token.objects.create(user=self.prof_user))
        response = self.client.post(self.url_preview, {"file": b"test"}, format="multipart")
        self.assertEqual(response.status_code, 403)

    def test_no_file_rejected(self):
        self.auth(self.reg_token)
        response = self.client.post(self.url_preview, {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("No file provided", response.data["detail"])

    def test_invalid_format_rejected(self):
        self.auth(self.reg_token)
        response = self.client.post(self.url_preview, {"file": b"not a valid file"}, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_valid_xlsx_returns_preview(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [
                ["id", "name"],
                [self.dept.id, "Computer Science"],
            ],
            "Rooms": [
                ["id", "name", "capacity", "department_id"],
                [None, "M101", 30, self.dept.id],
            ],
            "Subjects": [
                ["id", "code", "title", "units"],
                [None, "MATH101", "Calculus", 3],
            ],
            "Sections": [
                ["id", "name", "headcount"],
                [None, "MATH-1A", 25],
            ],
            "Professors": [
                ["id", "user_id", "department_id", "max_daily_hours", "max_consecutive"],
                [None, self.prof_user.id, self.dept.id, 8, 4],
            ],
            "Assignments": [
                ["id", "professor_id", "subject_id", "section_id"],
            ],
            "Meetings": [
                ["id", "assignment_id", "order", "mode", "duration_slots"],
            ],
            "Availability": [
                ["id", "professor_id", "day", "start_time", "end_time", "is_preferred"],
            ],
            "BusyBlocks": [
                ["id", "professor_id", "day", "start_time", "end_time"],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertIn("preview_token", response.data)
        self.assertEqual(response.data["summary"]["creates"], 4)
        self.assertEqual(response.data["summary"]["updates"], 1)

    def test_update_existing_records(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [
                ["id", "name"],
                [self.dept.id, "Computer Science"],
            ],
            "Rooms": [
                ["id", "name", "capacity", "department_id"],
                [self.room.id, "R101 Updated", 50, self.dept.id],
            ],
            "Subjects": [
                ["id", "code", "title", "units"],
                [self.subject.id, "CS101", "Introduction to CS", 4],
            ],
            "Sections": [
                ["id", "name", "headcount"],
                [self.section.id, "BSIT-3A", 35],
            ],
            "Professors": [
                ["id", "user_id", "department_id", "max_daily_hours", "max_consecutive"],
                [self.prof.id, self.prof_user.id, self.dept.id, 6, 3],
            ],
            "Assignments": [
                ["id", "professor_id", "subject_id", "section_id"],
            ],
            "Meetings": [
                ["id", "assignment_id", "order", "mode", "duration_slots"],
            ],
            "Availability": [
                ["id", "professor_id", "day", "start_time", "end_time", "is_preferred"],
            ],
            "BusyBlocks": [
                ["id", "professor_id", "day", "start_time", "end_time"],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["summary"]["updates"], 5)
        self.assertEqual(response.data["summary"]["creates"], 0)

    def test_missing_required_field_error(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [
                ["id", "name"],
                [1, ""],  # missing name
            ],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [["id", "user_id"]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"]],
            "Meetings": [["id", "assignment_id", "order", "mode"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertTrue(any(e["field"] == "name" for e in response.data["errors"]))

    def test_invalid_mode_error(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [1, "CS"]],
            "Rooms": [["id", "name", "capacity"], [1, "R101", 40]],
            "Subjects": [["id", "code", "title"], [1, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [1, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [1, self.prof_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"], [1, 1, 1, 1]],
            "Meetings": [["id", "assignment_id", "order", "mode"], [1, 1, 1, "lecture"]],  # invalid mode
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertTrue(any(e["field"] == "mode" for e in response.data["errors"]))

    def test_missing_sync_meeting_error(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [1, "CS"]],
            "Rooms": [["id", "name", "capacity"], [1, "R101", 40]],
            "Subjects": [["id", "code", "title"], [1, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [1, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [1, self.prof_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"], [1, 1, 1, 1]],
            "Meetings": [["id", "assignment_id", "order", "mode"], [1, 1, 1, "async"]],  # only async
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertTrue(any("synchronous" in e["message"] for e in response.data["errors"]))

    def test_foreign_key_validation(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [1, "CS"]],
            "Rooms": [["id", "name", "capacity", "department_id"], [1, "R101", 40, 999]],  # invalid dept
            "Subjects": [["id", "code", "title"], [1, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [1, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [1, self.prof_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"], [1, 1, 1, 1]],
            "Meetings": [["id", "assignment_id", "order", "mode"], [1, 1, 1, "sync"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertTrue(any(e["field"] == "department_id" for e in response.data["errors"]))

    def test_invalid_user_id_for_professor(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [1, "CS"]],
            "Rooms": [["id", "name", "capacity"], [1, "R101", 40]],
            "Subjects": [["id", "code", "title"], [1, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [1, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [1, 99999]],  # non-existent user
            "Assignments": [["id", "professor_id", "subject_id", "section_id"]],
            "Meetings": [["id", "assignment_id", "order", "mode"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])


class ImportStructureValidationTests(ImportTestCase):
    """Missing core sheets/headers are structural errors, not empty imports."""

    def _core_sheets(self):
        return {
            "Departments": [["id", "name"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [["id", "email"]],
        }

    def test_missing_core_sheet_rejected_without_token(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets()
        sheets.pop("Departments")
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertIn(
            "Missing sheet: Departments",
            [e["message"] for e in response.data["errors"]],
        )
        # No committable token is issued for a structurally invalid workbook.
        self.assertFalse(response.data["preview_token"])
        commit = self.client.post(
            self.url_commit,
            {"preview_token": response.data["preview_token"]},
            format="json",
        )
        self.assertEqual(commit.status_code, 400)
        self.assertIn("preview_token is required", commit.data["detail"])

    def test_empty_workbook_rejected(self):
        self.auth(self.reg_token)
        xlsx = self._make_xlsx({})
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        missing = {
            e["sheet"]
            for e in response.data["errors"]
            if e["message"].startswith("Missing sheet:")
        }
        self.assertEqual(missing, set(TEMPLATE_SHEETS))
        self.assertFalse(response.data["preview_token"])

    def test_missing_required_header_rejected(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets()
        sheets["Departments"] = [["id"]]  # missing 'name'
        sheets["Professors"] = [["id", "first_name"]]  # missing email/user_id
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        messages = [e["message"] for e in response.data["errors"]]
        self.assertIn("Missing required header(s): name", messages)
        self.assertIn("Missing required header(s): email or user_id", messages)
        self.assertFalse(response.data["preview_token"])


class ImportCommitTests(ImportTestCase):
    def test_commit_creates_records(self):
        self.auth(self.reg_token)
        # Create a new user without a professor profile
        new_user = User.objects.create_user(username="newprof", password="pass12345")
        sheets = {
            "Departments": [["id", "name"], [None, "Math"]],
            "Rooms": [["id", "name", "capacity"], [None, "M101", 30]],
            "Subjects": [["id", "code", "title"], [None, "MATH101", "Calculus"]],
            "Sections": [["id", "name", "headcount"], [None, "MATH-1A", 25]],
            "Professors": [["id", "user_id"], [None, new_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"]],
            "Meetings": [["id", "assignment_id", "order", "mode"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        preview_resp = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertTrue(preview_resp.data["valid"])
        token = preview_resp.data["preview_token"]

        commit_resp = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        
        self.assertEqual(commit_resp.status_code, 200)
        self.assertTrue(commit_resp.data["committed"])
        self.assertEqual(commit_resp.data["summary"]["creates"], 5)

        self.assertTrue(Department.objects.filter(name="Math").exists())
        self.assertTrue(Room.objects.filter(name="M101").exists())
        self.assertTrue(Subject.objects.filter(code="MATH101").exists())
        self.assertTrue(Section.objects.filter(name="MATH-1A").exists())
        self.assertEqual(
            Section.objects.get(name="MATH-1A").headcount,
            25,
        )
        self.assertTrue(Professors.objects.filter(user=new_user).exists())

    def test_commit_updates_records(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "Computer Science"]],
            "Rooms": [["id", "name", "capacity"], [self.room.id, "R101 Updated", 50]],
            "Subjects": [["id", "code", "title"], [self.subject.id, "CS101", "Intro to CS"]],
            "Sections": [["id", "name", "headcount"], [self.section.id, "BSIT-3A", 35]],
            "Professors": [["id", "user_id"], [self.prof.id, self.prof_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"]],
            "Meetings": [["id", "assignment_id", "order", "mode"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        preview_resp = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertTrue(preview_resp.data["valid"])
        token = preview_resp.data["preview_token"]

        commit_resp = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit_resp.status_code, 200)
        self.assertEqual(commit_resp.data["summary"]["updates"], 5)

        self.dept.refresh_from_db()
        self.assertEqual(self.dept.name, "Computer Science")
        self.room.refresh_from_db()
        self.assertEqual(self.room.name, "R101 Updated")
        self.assertEqual(self.room.capacity, 50)
        self.section.refresh_from_db()
        self.assertEqual(self.section.headcount, 35)

    def test_commit_uses_configured_default_duration(self):
        GlobalSettings.set("sync_duration_default", 4, user=self.registrar)
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"], [self.room.id, "R101", 40]],
            "Subjects": [["id", "code", "title"], [self.subject.id, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [self.section.id, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [self.prof.id, self.prof_user.id]],
            "Assignments": [
                ["id", "professor_id", "subject_id", "section_id"],
                [self.assignment.id, self.prof.id, self.subject.id, self.section.id],
            ],
            "Meetings": [
                ["id", "assignment_id", "order", "mode"],
                [None, self.assignment.id, 1, "sync"],
            ],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        preview_resp = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertTrue(preview_resp.data["valid"])
        token = preview_resp.data["preview_token"]

        commit_resp = self.client.post(
            self.url_commit, {"preview_token": token}, format="json"
        )
        self.assertEqual(commit_resp.status_code, 200)
        self.assertTrue(commit_resp.data["committed"])
        meeting = MeetingSlot.objects.get(assignment=self.assignment)
        self.assertEqual(meeting.duration_slots, 4)

    def test_commit_expired_token_rejected(self):
        self.auth(self.reg_token)
        response = self.client.post(self.url_commit, {"preview_token": "invalid-token"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["committed"])

    def test_commit_missing_token_rejected(self):
        self.auth(self.reg_token)
        response = self.client.post(self.url_commit, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("preview_token is required", response.data["detail"])

    def test_commit_atomic_rollback_on_error(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "code", "name"], [self.dept.id, "VDEPT", "Valid Dept"]],
            "Rooms": [["id", "name", "capacity", "department_id"], [self.room.id, "R101", 40, self.dept.id]],
            "Subjects": [["id", "code", "title", "department_id"], [self.subject.id, "CS101", "Intro", self.dept.id]],
            "Sections": [["id", "name", "headcount", "department_id"], [self.section.id, "BSIT-3A", 30, self.dept.id]],
            "Professors": [["id", "user_id", "department_id"], [self.prof.id, self.prof_user.id, self.dept.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"], [self.assignment.id, self.prof.id, self.subject.id, self.section.id]],
            "Meetings": [["id", "assignment_id", "order", "mode"], [None, self.assignment.id, 1, "sync"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        xlsx = self._make_xlsx(sheets)
        preview_resp = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertTrue(preview_resp.data["valid"])
        token = preview_resp.data["preview_token"]

        # Delete the professor user to cause commit failure
        self.prof_user.delete()

        commit_resp = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit_resp.status_code, 400)
        self.assertFalse(commit_resp.data["committed"])

        # Verify nothing was created (rollback)
        self.assertFalse(Department.objects.filter(name="Valid Dept").exists())


class ImportEmailProfessorsTests(ImportTestCase):
    """Email-based Professors rows plus legacy user_id compatibility."""

    def _core_sheets(self, professors_rows, professors_headers=None):
        if professors_headers is None:
            professors_headers = [
                "id", "email", "first_name", "last_name",
                "department_id", "max_hours", "max_consecutive",
            ]
        return {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [professors_headers, *professors_rows],
        }

    def test_email_row_creates_new_professor(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets([
            [None, "New.Prof@Example.COM", "New", "Prof", self.dept.id, 6, 3],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["summary"]["creates"], 1)  # professor create
        self.assertEqual(response.data["summary"]["updates"], 1)  # department update

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 200)
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["creates"], 1)
        self.assertEqual(commit.data["summary"]["updates"], 1)

        user = User.objects.filter(email__iexact="new.prof@example.com").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.email, "new.prof@example.com")  # lowercased
        self.assertFalse(user.has_usable_password())
        prof = Professors.objects.get(user=user)
        self.assertEqual(prof.department, self.dept)
        self.assertEqual(prof.max_daily_hours, 6)
        self.assertEqual(prof.max_consecutive, 3)

    def test_email_row_updates_existing_professor(self):
        self.auth(self.reg_token)
        self.prof_user.email = "prof1@example.com"
        self.prof_user.save()
        old_password = self.prof_user.password

        sheets = self._core_sheets([
            [self.prof.id, "PROF1@EXAMPLE.COM", "Updated", "Name", self.dept.id, 5, 2],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["summary"]["updates"], 2)  # dept + professor

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["updates"], 2)
        self.assertEqual(commit.data["summary"]["creates"], 0)

        self.prof_user.refresh_from_db()
        self.assertEqual(self.prof_user.password, old_password)  # no reset
        self.assertTrue(self.prof_user.check_password("pass12345"))
        self.assertEqual(self.prof_user.email, "prof1@example.com")
        self.assertEqual(self.prof_user.first_name, "Updated")
        # No new user was created for the existing email.
        self.assertEqual(User.objects.filter(email__iexact="prof1@example.com").count(), 1)
        self.assertEqual(Professors.objects.count(), 2)
        prof = Professors.objects.get(user=self.prof_user)
        self.assertEqual(prof.max_daily_hours, 5)
        self.assertEqual(prof.max_consecutive, 2)

    def test_legacy_user_id_row_still_previews_and_commits(self):
        self.auth(self.reg_token)
        new_user = User.objects.create_user(username="legacyprof", password="pass12345")
        sheets = self._core_sheets(
            [[None, new_user.id, self.dept.id, 7, 3]],
            professors_headers=["id", "user_id", "department_id", "max_daily_hours", "max_consecutive"],
        )
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["summary"]["creates"], 1)  # professor create
        self.assertEqual(response.data["summary"]["updates"], 1)  # department update

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertTrue(commit.data["committed"])
        prof = Professors.objects.get(user=new_user)
        self.assertEqual(prof.department, self.dept)
        self.assertEqual(prof.max_daily_hours, 7)

    def test_max_hours_maps_to_max_daily_hours(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets(
            [
                [None, "hours1@example.com", None, None, None, 5, None],
                [None, "hours2@example.com", None, None, None, None, 7],
            ],
            professors_headers=["id", "email", "first_name", "last_name",
                                "department_id", "max_hours", "max_daily_hours"],
        )
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertTrue(commit.data["committed"])

        prof1 = Professors.objects.get(user__email="hours1@example.com")
        self.assertEqual(prof1.max_daily_hours, 5)  # canonical max_hours
        prof2 = Professors.objects.get(user__email="hours2@example.com")
        self.assertEqual(prof2.max_daily_hours, 7)  # legacy header accepted

    def test_whitespace_only_email_treated_as_blank(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets([
            [None, "   ", "Blank", "Email", None, None, None],
            [None, "space@example.com", "Real", "Email", None, None, None],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        prof_errors = [
            e for e in response.data["errors"] if e["sheet"] == "Professors"
        ]
        self.assertEqual(len(prof_errors), 1)
        self.assertEqual(prof_errors[0]["row"], 2)
        self.assertEqual(prof_errors[0]["field"], "email")
        # Blank falls through to the email-OR-user_id rule; it is not a
        # malformed email.
        self.assertIn("requires 'email'", prof_errors[0]["message"])
        self.assertNotIn("Invalid email", prof_errors[0]["message"])

        prof_items = {
            item["row"]: item for item in response.data["preview_items"]["Professors"]
        }
        self.assertEqual(prof_items[2]["action"], "error")
        self.assertEqual(prof_items[3]["action"], "create")

    def test_duplicate_emails_in_workbook_rejected(self):
        self.auth(self.reg_token)
        sheets = self._core_sheets([
            [None, "dup@example.com", None, None, None, None, None],
            [None, "DUP@example.com", None, None, None, None, None],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        self.assertTrue(
            any(
                e["field"] == "email" and "email" in e["message"].lower()
                for e in response.data["errors"]
            )
        )


class ImportSectionProgramTests(ImportTestCase):
    def test_supplied_program_persists_and_blank_derives(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [
                ["id", "name", "headcount", "program"],
                [None, "BSCS 3-C", 30, "BSCS"],
                [None, "BSIT 3-A", 25, ""],
            ],
            "Professors": [["id", "email"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertTrue(commit.data["committed"])

        supplied = Section.objects.get(name="BSCS 3-C")
        self.assertEqual(supplied.program, "BSCS")
        derived = Section.objects.get(name="BSIT 3-A")
        self.assertEqual(derived.program, "BSIT")  # derived from the name


REQUIRED_INSTRUCTION_STATEMENTS = [
    "Leave ID blank to CREATE a new record. Select from dropdown or type existing ID to UPDATE.",
    "You must upload Departments/Subjects first before uploading Rooms/Professors.",
    "New professors can be added by leaving ID blank and typing a new email.",
]


class ImportRowLevelErrorTests(ImportTestCase):
    """Row-level failures isolate the bad row and keep good rows committable."""

    def _professors_row(self, *values):
        return list(values)

    def test_row_level_error_allows_partial_commit(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "first_name", "last_name",
                 "department_id", "max_hours", "max_consecutive"],
                # Row 2: good row (new professor).
                [None, "good.prof@example.com", "Good", "Prof", None, None, None],
                # Row 3: duplicate email (case-insensitive) -> row error.
                [None, "GOOD.PROF@example.com", "Dup", "Prof", None, None, None],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        dup_errors = [
            e for e in response.data["errors"]
            if e["sheet"] == "Professors" and e["field"] == "email"
        ]
        self.assertEqual(len(dup_errors), 1)
        self.assertEqual(dup_errors[0]["row"], 3)

        # Good row still counted as a create; bad row marked as error.
        prof_items = {
            item["row"]: item for item in response.data["preview_items"]["Professors"]
        }
        self.assertEqual(prof_items[2]["action"], "create")
        self.assertEqual(prof_items[2]["errors"], [])
        self.assertEqual(prof_items[3]["action"], "error")
        self.assertTrue(prof_items[3]["errors"])

        # Default selection path: commit only the non-error rows.
        token = response.data["preview_token"]
        commit = self.client.post(
            self.url_commit,
            {"preview_token": token, "selected_keys": ["Professors:2"]},
            format="json",
        )
        self.assertEqual(commit.status_code, 200)
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["creates"], 1)

        user = User.objects.filter(email__iexact="good.prof@example.com").first()
        self.assertIsNotNone(user)
        # The duplicate row was NOT imported: exactly one professor account.
        self.assertEqual(
            Professors.objects.filter(user__email__iexact="good.prof@example.com").count(),
            1,
        )

    def test_commit_without_selection_excludes_error_rows(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [
                ["id", "name", "capacity", "department_id"],
                [None, "GOOD-ROOM", 30, self.dept.id],
                [None, "BAD-ROOM", 30, 9999],  # bad FK -> error row
            ],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "first_name", "last_name",
                 "department_id", "max_hours", "max_consecutive"],
                [None, "dup@example.com", "First", "Prof", None, None, None],
                [None, "DUP@example.com", "Second", "Prof", None, None, None],
                [None, "valid@example.com", "Valid", "Prof", self.dept.id, None, None],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        token = response.data["preview_token"]
        # No selected_keys: commit all non-error rows, never the error rows.
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 200)
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["creates"], 3)  # room + 2 professors
        self.assertEqual(commit.data["summary"]["updates"], 1)  # department

        self.assertTrue(Room.objects.filter(name="GOOD-ROOM").exists())
        self.assertFalse(Room.objects.filter(name="BAD-ROOM").exists())
        self.assertTrue(User.objects.filter(email__iexact="valid@example.com").exists())

        # The duplicate email row was skipped: exactly one account, and the
        # first occurrence's data was not overwritten by the errored row.
        self.assertEqual(User.objects.filter(email__iexact="dup@example.com").count(), 1)
        dup_prof = Professors.objects.get(user__email__iexact="dup@example.com")
        self.assertEqual(dup_prof.user.first_name, "First")

    def test_legacy_sheets_create_with_typed_new_ids(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"], [self.subject.id, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [self.section.id, "BSIT-3A", 30]],
            "Professors": [
                ["id", "user_id", "department_id", "max_daily_hours", "max_consecutive"],
                [self.prof.id, self.prof_user.id, self.dept.id, 8, 4],
            ],
            "Assignments": [
                ["id", "professor_id", "subject_id", "section_id"],
                [5001, self.prof.id, self.subject.id, self.section.id],
            ],
            "Meetings": [
                ["id", "assignment_id", "order", "mode"],
                [6001, 5001, 1, "sync"],
            ],
            "Availability": [
                ["id", "professor_id", "day", "start_time", "end_time"],
                [7001, self.prof.id, "Monday", "08:00", "10:00"],
            ],
            "BusyBlocks": [
                ["id", "professor_id", "day", "start_time", "end_time"],
                [8001, self.prof.id, "Tuesday", "13:00", "15:00"],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data.get("errors"))
        self.assertTrue(response.data["valid"])

        # Legacy typed ids preview as creates, not "id does not exist" errors.
        for sheet, row_num in (
            ("Assignments", 2),
            ("Meetings", 2),
            ("Availability", 2),
            ("BusyBlocks", 2),
        ):
            items = {
                item["row"]: item for item in response.data["preview_items"][sheet]
            }
            self.assertEqual(items[row_num]["action"], "create", sheet)
            self.assertEqual(items[row_num]["errors"], [], sheet)

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["creates"], 4)
        self.assertEqual(commit.data["summary"]["updates"], 4)

        self.assertTrue(Assignment.objects.filter(id=5001).exists())
        self.assertTrue(MeetingSlot.objects.filter(id=6001).exists())
        self.assertTrue(AvailabilityWindow.objects.filter(id=7001).exists())
        self.assertTrue(BusyBlock.objects.filter(id=8001).exists())

    def test_non_integer_numeric_fields_rejected(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [
                ["id", "code", "title", "units"],
                [None, "BAD-UNITS", "Bad Units", "abc"],
            ],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "max_hours", "max_consecutive"],
                [None, "bad.hours@example.com", "abc", "abc"],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        fields = {(e["sheet"], e["field"]) for e in response.data["errors"]}
        self.assertIn(("Subjects", "units"), fields)
        self.assertIn(("Professors", "max_hours"), fields)
        self.assertIn(("Professors", "max_consecutive"), fields)

        subject_items = {
            item["row"]: item for item in response.data["preview_items"]["Subjects"]
        }
        self.assertEqual(subject_items[2]["action"], "error")
        prof_items = {
            item["row"]: item for item in response.data["preview_items"]["Professors"]
        }
        self.assertEqual(prof_items[2]["action"], "error")

    def test_nonexistent_id_rejected(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [9999, "Ghost Dept"]],
            "Rooms": [["id", "name", "capacity"], [None, "N1", 20]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [["id", "email"]],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        id_errors = [
            e for e in response.data["errors"]
            if e["sheet"] == "Departments" and e["field"] == "id"
        ]
        self.assertEqual(len(id_errors), 1)
        self.assertEqual(id_errors[0]["row"], 2)
        self.assertIn("does not exist", id_errors[0]["message"])

        dept_items = {
            item["row"]: item for item in response.data["preview_items"]["Departments"]
        }
        self.assertEqual(dept_items[2]["action"], "error")
        self.assertEqual(dept_items[2]["errors"], [id_errors[0]["message"]])

        token = response.data["preview_token"]
        # Default commit (no selection) skips the errored Departments row and
        # commits only the valid Rooms row.
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 200)
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"]["creates"], 1)
        self.assertFalse(Department.objects.filter(id=9999).exists())
        self.assertTrue(Room.objects.filter(name="N1").exists())

    def test_department_fk_is_db_only(self):
        self.auth(self.reg_token)
        # Exists in the DB but is NOT listed in the workbook's Departments sheet.
        math_dept = Department.objects.create(name="Math")
        sheets = {
            "Departments": [
                ["id", "name"],
                [self.dept.id, "CS"],
                [7001, "Workbook Only Dept"],  # id not in the DB -> id error
            ],
            "Rooms": [
                ["id", "name", "capacity", "department_id"],
                [None, "R-DB", 30, math_dept.id],  # existing-DB reference
                [None, "R-WBONLY", 30, 7001],  # workbook-only -> rejected
                [None, "R-BAD", 30, 9999],  # neither -> rejected
                [None, "R-NONINT", 30, "abc"],  # non-integer -> rejected
            ],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "department_id"],
                [None, "wb.dept@example.com", 7001],  # workbook-only -> rejected
                [None, "bad.dept@example.com", 9999],  # missing in DB -> rejected
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        fk_errors = [
            e for e in response.data["errors"] if e["field"] == "department_id"
        ]
        self.assertEqual(len(fk_errors), 5)
        self.assertTrue(
            any("must be an integer" in e["message"] for e in fk_errors)
        )
        self.assertTrue(
            any("not found in database" in e["message"] for e in fk_errors)
        )

        # Only the existing-DB reference is clean; every workbook-only or
        # nonexistent id is a row error even though it appears in the sheet.
        room_items = {
            item["row"]: item for item in response.data["preview_items"]["Rooms"]
        }
        self.assertEqual(room_items[2]["action"], "create")
        self.assertEqual(room_items[2]["errors"], [])
        for row_num in (3, 4, 5):
            self.assertEqual(room_items[row_num]["action"], "error", row_num)
            self.assertTrue(room_items[row_num]["errors"], row_num)

        prof_items = {
            item["row"]: item for item in response.data["preview_items"]["Professors"]
        }
        for row_num in (2, 3):
            self.assertEqual(prof_items[row_num]["action"], "error", row_num)
            self.assertTrue(prof_items[row_num]["errors"], row_num)

        # The workbook-only department row itself is flagged by the
        # id-must-exist rule (separate from the FK check).
        self.assertTrue(
            any(
                e["sheet"] == "Departments"
                and e["field"] == "id"
                and e["row"] == 3
                for e in response.data["errors"]
            )
        )

    def test_duplicate_email_flags_second_occurrence_only(self):
        self.auth(self.reg_token)
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "first_name", "last_name",
                 "department_id", "max_hours", "max_consecutive"],
                [None, "Shared@Example.com", "First", "Prof", None, None, None],
                [None, "shared@example.com", "Second", "Prof", None, None, None],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        email_errors = [
            e for e in response.data["errors"]
            if e["sheet"] == "Professors" and e["field"] == "email"
        ]
        self.assertEqual(len(email_errors), 1)
        self.assertEqual(email_errors[0]["row"], 3)

        prof_items = {
            item["row"]: item for item in response.data["preview_items"]["Professors"]
        }
        # First occurrence is fine and still committable.
        self.assertEqual(prof_items[2]["action"], "create")
        self.assertEqual(prof_items[2]["errors"], [])
        # Second occurrence is flagged on its own row.
        self.assertEqual(prof_items[3]["action"], "error")
        self.assertEqual(prof_items[3]["errors"], [email_errors[0]["message"]])


class ImportTemplateTests(ImportTestCase):
    def test_xlsx_template_download(self):
        self.auth(self.reg_token)
        response = self.client.get(self.url_template)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn("schedule_import_template.xlsx", response["Content-Disposition"])

        content = b"".join(response.streaming_content)
        wb = load_workbook(BytesIO(content))
        self.assertEqual(set(wb.sheetnames), set([
            "Departments", "Rooms", "Subjects", "Sections", "Professors",
            "ProfessorPreferences", "Instructions", "_Lists",
        ]))
        self.assertEqual(wb["_Lists"].sheet_state, "hidden")

        for sheet_name in ["Departments", "Rooms", "Subjects", "Sections", "Professors"]:
            ws = wb[sheet_name]
            self.assertEqual(ws.cell(row=1, column=1).value, "id")

        # Headers only: no database rows and no sample rows.
        for sheet_name in ["Departments", "Subjects", "Sections"]:
            self.assertEqual(wb[sheet_name].max_row, 1)
        # Rooms/Professors carry only the 500 auto-fill formula rows.
        for sheet_name in ["Rooms", "Professors"]:
            self.assertEqual(wb[sheet_name].max_row, 501)
            self.assertIsNone(wb[sheet_name].cell(row=2, column=1).value)

        # Professors sheet is email-based; Sections has the program column.
        prof_headers = [cell.value for cell in wb["Professors"][1]]
        self.assertIn("email", prof_headers)
        self.assertNotIn("user_id", prof_headers)
        self.assertIn("program", [cell.value for cell in wb["Sections"][1]])

        # The hidden _Lists sheet carries the live department ids.
        lists_ws = wb["_Lists"]
        self.assertEqual(lists_ws["A1"].value, "department_id")
        self.assertEqual(lists_ws["B1"].value, "department_name")
        list_ids = [row[0] for row in lists_ws.iter_rows(min_row=2, values_only=True)]
        self.assertIn(self.dept.id, list_ids)

        # department_id dropdowns reference the _Lists sheet.
        for sheet_name, dept_col in (("Rooms", "D"), ("Professors", "E")):
            list_dvs = [
                dv
                for dv in wb[sheet_name].data_validations.dataValidation
                if dv.type == "list"
            ]
            self.assertEqual(len(list_dvs), 1, sheet_name)
            self.assertEqual(list_dvs[0].formula1, "_Lists!$A$2:$A$2000")
            self.assertIn(dept_col, str(list_dvs[0].sqref))

        instructions_blob = " ".join(
            str(cell)
            for row in wb["Instructions"].iter_rows(values_only=True)
            for cell in row
            if cell
        )
        for statement in REQUIRED_INSTRUCTION_STATEMENTS:
            self.assertIn(statement, instructions_blob)

    def test_data_transfer_template_defaults_to_xlsx(self):
        self.auth(self.reg_token)
        response = self.client.get(self.url_data_transfer_template)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn(
            "schedule_import_template.xlsx",
            response["Content-Disposition"],
        )

    def test_data_transfer_template_csv_format(self):
        self.auth(self.reg_token)
        response = self.client.get(
            f"{self.url_data_transfer_template}?format=csv"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertIn(
            "schedule_import_template.zip",
            response["Content-Disposition"],
        )

    def test_data_transfer_template_rejects_unknown_format(self):
        self.auth(self.reg_token)
        response = self.client.get(
            f"{self.url_data_transfer_template}?format=pdf"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported template format", response.data["detail"])

    def test_csv_template_download(self):
        self.auth(self.reg_token)
        response = self.client.get(self.url_template_csv)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertIn("schedule_import_template.zip", response["Content-Disposition"])

        content = b"".join(response.streaming_content)
        with zipfile.ZipFile(BytesIO(content), "r") as zf:
            names = zf.namelist()
            for sheet in ["Departments", "Rooms", "Subjects", "Sections", "Professors"]:
                self.assertIn(f"{sheet}.csv", names)
                # Header rows only: no sample data rows.
                lines = zf.read(f"{sheet}.csv").decode("utf-8").strip().splitlines()
                self.assertEqual(len(lines), 1, sheet)
            self.assertIn("ProfessorPreferences.csv", names)
            self.assertIn("Instructions.txt", names)
            self.assertEqual(len(names), 7)  # 6 CSVs + Instructions.txt

            instructions = zf.read("Instructions.txt").decode("utf-8")
            for statement in REQUIRED_INSTRUCTION_STATEMENTS:
                self.assertIn(statement, instructions)

    def test_professor_cannot_access_template(self):
        self.auth(Token.objects.create(user=self.prof_user))
        response = self.client.get(self.url_template)
        self.assertEqual(response.status_code, 403)


class ImportProcessorUnitTests(ImportTestCase):
    def test_parse_time_formats(self):
        self.assertEqual(parse_time("08:00"), dtime(8, 0))
        self.assertEqual(parse_time("13:30"), dtime(13, 30))
        self.assertIsNone(parse_time(""))
        self.assertIsNone(parse_time(None))

    def test_parse_day_formats(self):
        self.assertEqual(parse_day(0), 0)
        self.assertEqual(parse_day("Monday"), 0)
        self.assertEqual(parse_day("Mon"), 0)
        self.assertEqual(parse_day("5"), 5)
        self.assertIsNone(parse_day(""))
        self.assertIsNone(parse_day(None))
        self.assertIsNone(parse_day("Invalid"))

    def test_parse_mode(self):
        self.assertEqual(parse_mode("async"), "async")
        self.assertEqual(parse_mode("SYNC"), "sync")
        self.assertEqual(parse_mode("Lab"), "lab")
        self.assertIsNone(parse_mode("lecture"))
        self.assertIsNone(parse_mode(""))

    def test_parse_days_multi_day_patterns(self):
        self.assertEqual(parse_days("MWF"), ["MON", "WED", "FRI"])
        self.assertEqual(parse_days("TTH"), ["TUE", "THU"])
        self.assertEqual(parse_days("MON,WED"), ["MON", "WED"])
        self.assertEqual(parse_days("MON-FRI"), ["MON", "TUE", "WED", "THU", "FRI"])
        self.assertEqual(parse_days("m w f"), ["MON", "WED", "FRI"])
        self.assertEqual(parse_days(1), ["TUE"])
        self.assertIsNone(parse_days(""))
        self.assertIsNone(parse_days("FUNDAY"))

    def test_build_preference_meetings_from_atomic_times(self):
        meetings = build_preference_meetings(
            {
                "days": "MWF",
                "start_time": "08:00",
                "end_time": "10:00",
                "mode": "sync",
            }
        )
        self.assertEqual(len(meetings), 3)
        self.assertEqual(meetings[0]["preferred_days"], [0])
        self.assertEqual(meetings[1]["preferred_days"], [2])
        self.assertEqual(meetings[2]["preferred_days"], [4])
        self.assertEqual(meetings[0]["duration_slots"], 2)
        self.assertEqual(meetings[0]["preferred_start"], "08:00")
        self.assertEqual(meetings[0]["preferred_end"], "10:00")
        # Legacy 3-column rows have no meeting data.
        self.assertIsNone(
            build_preference_meetings(
                {"professor_email": "p@example.com", "subject_code": "CS101"}
            )
        )

    def test_generate_template_xlsx(self):
        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))
        self.assertEqual(set(wb.sheetnames), set([
            "Departments", "Rooms", "Subjects", "Sections", "Professors",
            "ProfessorPreferences", "Instructions", "_Lists",
        ]))
        self.assertEqual(wb["_Lists"].sheet_state, "hidden")

        # All five core sheets are headers-only (no data rows).
        self.assertEqual(
            [c.value for c in wb["ProfessorPreferences"][1]],
            [
                "professor_email",
                "subject_code",
                "priority",
                "days",
                "start_time",
                "end_time",
                "mode",
            ],
        )
        self.assertEqual(wb["ProfessorPreferences"].max_row, 1)
        for sheet_name in ["Departments", "Subjects", "Sections"]:
            self.assertEqual(wb[sheet_name].max_row, 1)

        sections_headers = [cell.value for cell in wb["Sections"][1]]
        self.assertIn("headcount", sections_headers)
        self.assertIn("program", sections_headers)

        # Rooms: auto-fill formula in rows 2..501 anchored on department_id
        # (column D), data columns still empty.
        rooms = wb["Rooms"]
        self.assertEqual(
            [c.value for c in rooms[1]],
            ["id", "name", "capacity", "department_id", "department_name"],
        )
        self.assertIsNone(rooms["D2"].value)
        expected_rooms_row2 = (
            '=IFERROR(IF($D2="","",INDEX(Departments!$B:$B,'
            'MATCH($D2,Departments!$A:$A,0))),"")'
        )
        expected_rooms_row501 = (
            '=IFERROR(IF($D501="","",INDEX(Departments!$B:$B,'
            'MATCH($D501,Departments!$A:$A,0))),"")'
        )
        self.assertEqual(rooms["E2"].value, expected_rooms_row2)
        self.assertEqual(rooms["E501"].value, expected_rooms_row501)
        self.assertIsNone(rooms["E502"].value)

        # Professors: same pattern anchored on department_id (column E).
        profs = wb["Professors"]
        self.assertEqual(
            [c.value for c in profs[1]],
            [
                "id", "email", "first_name", "last_name", "department_id",
                "max_hours", "max_consecutive", "department_name",
            ],
        )
        expected_profs_row2 = (
            '=IFERROR(IF($E2="","",INDEX(Departments!$B:$B,'
            'MATCH($E2,Departments!$A:$A,0))),"")'
        )
        expected_profs_row501 = (
            '=IFERROR(IF($E501="","",INDEX(Departments!$B:$B,'
            'MATCH($E501,Departments!$A:$A,0))),"")'
        )
        self.assertEqual(profs["H2"].value, expected_profs_row2)
        self.assertEqual(profs["H501"].value, expected_profs_row501)
        self.assertIsNone(profs["B2"].value)

        # List dropdowns fed by the hidden _Lists sheet.
        for sheet_name, dept_col in (("Rooms", "D"), ("Professors", "E")):
            list_dvs = [
                dv
                for dv in wb[sheet_name].data_validations.dataValidation
                if dv.type == "list"
            ]
            self.assertEqual(len(list_dvs), 1, sheet_name)
            self.assertEqual(list_dvs[0].formula1, "_Lists!$A$2:$A$2000")
            self.assertIn(dept_col, str(list_dvs[0].sqref))
            self.assertTrue(list_dvs[0].allow_blank)

        # _Lists column A holds the department ids that exist in the DB.
        lists_ws = wb["_Lists"]
        self.assertEqual(lists_ws["A1"].value, "department_id")
        self.assertEqual(lists_ws["B1"].value, "department_name")
        list_ids = [row[0] for row in lists_ws.iter_rows(min_row=2, values_only=True)]
        self.assertIn(self.dept.id, list_ids)

    def test_generate_template_csv_zip(self):
        content = processor.generate_template_csv_zip()
        with zipfile.ZipFile(BytesIO(content), "r") as zf:
            names = zf.namelist()
            for sheet in ["Departments", "Rooms", "Subjects", "Sections", "Professors", "ProfessorPreferences"]:
                self.assertIn(f"{sheet}.csv", names)
                # Header rows only: no sample data rows.
                lines = zf.read(f"{sheet}.csv").decode("utf-8").strip().splitlines()
                self.assertEqual(len(lines), 1, sheet)
            self.assertIn("Instructions.txt", names)
            self.assertEqual(len(names), 7)  # 6 CSVs + Instructions.txt

    def test_csv_zip_parsing(self):
        sheets = {
            "Departments": [["id", "name"], ["", "Physics"]],
            "Rooms": [["id", "name", "capacity"], ["", "P101", "25"]],
            "Subjects": [["id", "code", "title"], ["", "PHYS101", "Physics"]],
            "Sections": [["id", "name", "headcount"], ["", "PHYS-1A", "20"]],
            "Professors": [["id", "user_id"], ["", str(self.prof_user2.id)]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"]],
            "Meetings": [["id", "assignment_id", "order", "mode"]],
            "Availability": [["id", "professor_id", "day", "start_time", "end_time"]],
            "BusyBlocks": [["id", "professor_id", "day", "start_time", "end_time"]],
        }
        csv_zip = self._make_csv_zip(sheets)
        csv_zip.name = "test.zip"
        parsed = processor.parse_file(csv_zip)
        self.assertEqual(len(parsed["Departments"]), 1)
        self.assertEqual(parsed["Departments"][0]["name"], "Physics")

    def test_malformed_csv_row_skipped_not_fatal(self):
        # A row that makes csv raise (field larger than the field limit) is
        # captured as a structured row error; the remaining rows survive.
        oversized = "X" * 200000
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "Departments.csv", f"id,name\r\n,{oversized}\r\n,OK Dept\r\n"
            )
            zf.writestr("Rooms.csv", "id,name,capacity\r\n")
            zf.writestr("Subjects.csv", "id,code,title\r\n")
            zf.writestr("Sections.csv", "id,name,headcount\r\n")
            zf.writestr("Professors.csv", "id,email\r\n")
        buf.seek(0)
        buf.name = "test.zip"

        parsed = processor.parse_file(buf)
        self.assertEqual(len(parsed["_parse_errors"]), 1)
        err = parsed["_parse_errors"][0]
        self.assertEqual(err["sheet"], "Departments")
        self.assertEqual(err["row"], 2)
        self.assertEqual(err["field"], "")
        self.assertIn("malformed", err["message"])
        # The row after the malformed one was still imported into the parse
        # result (it will surface as a validation row, not vanish).
        self.assertEqual([r["name"] for r in parsed["Departments"]], ["OK Dept"])

        # validate_all drains parse errors into the structured error shape.
        result = processor.validate_all(parsed)
        self.assertFalse(result.valid)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].sheet, "Departments")
        self.assertEqual(result.errors[0].row, 2)

        # Row validation still runs for valid sibling rows, so the good row
        # remains previewable and partially committable despite the parse
        # error on the previous row.
        dept_items = {
            item["row"]: item for item in result.preview_items["Departments"]
        }
        self.assertEqual(dept_items[3]["action"], "create")
        self.assertEqual(dept_items[3]["errors"], [])


class ImportTemplateBehaviorTests(ImportTestCase):
    def test_roundtrip_generated_template_previews_valid(self):
        self.auth(self.reg_token)
        # openpyxl-generated formulas carry no cached values; the parser
        # must ignore the read-only display columns regardless. The template
        # is headers-only, so nothing should be queued for create/update.
        content = processor.generate_template_xlsx()
        buf = BytesIO(content)
        buf.name = "template.xlsx"
        response = self.client.post(self.url_preview, {"file": buf}, format="multipart")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"], response.data.get("errors"))
        self.assertEqual(response.data["summary"]["updates"], 0)
        self.assertEqual(response.data["summary"]["creates"], 0)
        self.assertEqual(response.data["errors"], [])

        # The headers-only template is a committable no-op.
        before = (
            Department.objects.count(),
            Room.objects.count(),
            Subject.objects.count(),
            Section.objects.count(),
            Professors.objects.count(),
        )
        token = response.data["preview_token"]
        commit = self.client.post(
            self.url_commit, {"preview_token": token}, format="json"
        )
        self.assertEqual(commit.status_code, 200)
        self.assertTrue(commit.data["committed"])
        self.assertEqual(commit.data["summary"], {"creates": 0, "updates": 0})
        after = (
            Department.objects.count(),
            Room.objects.count(),
            Subject.objects.count(),
            Section.objects.count(),
            Professors.objects.count(),
        )
        self.assertEqual(before, after)

    def test_template_headers_only_when_db_empty(self):
        Professors.objects.all().delete()
        Room.objects.all().delete()
        Subject.objects.all().delete()
        Section.objects.all().delete()
        Department.objects.all().delete()

        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))

        # All five core sheets are headers-only even with an empty database.
        for sheet_name in ["Departments", "Subjects", "Sections"]:
            self.assertEqual(wb[sheet_name].max_row, 1)

        prof_ws = wb["Professors"]
        self.assertEqual(prof_ws.cell(row=1, column=1).value, "id")
        self.assertIn("email", [c.value for c in prof_ws[1]])
        self.assertIsNone(prof_ws.cell(row=2, column=1).value)
        self.assertEqual(wb["Rooms"].max_row, 501)  # formula rows only

        # _Lists is hidden and empty apart from its header row.
        self.assertEqual(wb["_Lists"].sheet_state, "hidden")
        self.assertEqual(wb["_Lists"].max_row, 1)
        self.assertIsNone(wb["_Lists"]["A2"].value)

    def test_template_rooms_and_professors_auto_fill_formulas(self):
        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))

        rooms_ws = wb["Rooms"]
        headers = [c.value for c in rooms_ws[1]]
        self.assertEqual(
            headers,
            ["id", "name", "capacity", "department_id", "department_name"],
        )
        self.assertEqual(
            rooms_ws["E2"].value,
            '=IFERROR(IF($D2="","",INDEX(Departments!$B:$B,'
            'MATCH($D2,Departments!$A:$A,0))),"")',
        )
        self.assertEqual(
            rooms_ws["E501"].value,
            '=IFERROR(IF($D501="","",INDEX(Departments!$B:$B,'
            'MATCH($D501,Departments!$A:$A,0))),"")',
        )

        profs_ws = wb["Professors"]
        self.assertEqual(
            [c.value for c in profs_ws[1]],
            [
                "id", "email", "first_name", "last_name", "department_id",
                "max_hours", "max_consecutive", "department_name",
            ],
        )
        self.assertEqual(
            profs_ws["H2"].value,
            '=IFERROR(IF($E2="","",INDEX(Departments!$B:$B,'
            'MATCH($E2,Departments!$A:$A,0))),"")',
        )
        self.assertEqual(
            profs_ws["H501"].value,
            '=IFERROR(IF($E501="","",INDEX(Departments!$B:$B,'
            'MATCH($E501,Departments!$A:$A,0))),"")',
        )


class ImportProfessorPreferencesTests(ImportTestCase):
    def _active_term(self):
        return AcademicTerm.objects.create(
            year=2026,
            semester=1,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 5, 1),
            is_active=True,
        )

    def _sheets(self, pref_rows, subject_rows=None, professor_rows=None):
        return {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [
                ["id", "code", "title"],
                [self.subject.id, "CS101", "Intro"],
                *(subject_rows or []),
            ],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "department_id"],
                *(professor_rows or []),
            ],
            "ProfessorPreferences": [
                ["professor_email", "subject_code", "priority"],
                *pref_rows,
            ],
        }

    def test_multi_subject_preferences_preview_and_commit(self):
        self.auth(self.reg_token)
        term = self._active_term()
        sheets = self._sheets(
            [
                ["pref.prof@example.com", "CS101", None],
                ["PREF.PROF@example.com", "MATH101", None],
            ],
            subject_rows=[[None, "MATH101", "Calculus"]],
            professor_rows=[[None, "pref.prof@example.com", self.dept.id]],
        )
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data.get("errors"))
        self.assertTrue(response.data["valid"])

        items = response.data["preview_items"]["ProfessorPreferences"]
        self.assertEqual([item["action"] for item in items], ["create", "create"])

        token = response.data["preview_token"]
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))
        self.assertTrue(commit.data["committed"])

        prof = Professors.objects.get(user__email__iexact="pref.prof@example.com")
        prefs = ProfessorPreference.objects.filter(professor=prof, term=term).order_by("priority")
        self.assertEqual(list(prefs.values_list("subject__code", "priority")), [
            ("CS101", 1),
            ("MATH101", 2),
        ])
        self.assertIsNone(prefs[0].section)

        submission = PreferenceSubmission.objects.get(term=term, department=self.dept)
        self.assertEqual(submission.submitted_by, self.registrar)
        self.assertEqual(SubmissionItem.objects.filter(submission=submission).count(), 2)

    def test_unknown_professor_and_subject_are_row_errors(self):
        self.auth(self.reg_token)
        self._active_term()
        sheets = self._sheets([
            ["missing.prof@example.com", "CS101", 1],
            ["prof.prof@example.com", "NOPE101", 1],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])

        fields = {e["field"] for e in response.data["errors"] if e["sheet"] == "ProfessorPreferences"}
        self.assertIn("professor_email", fields)
        self.assertIn("subject_code", fields)
        items = response.data["preview_items"]["ProfessorPreferences"]
        self.assertEqual([item["action"] for item in items], ["error", "error"])

    def test_duplicate_pairs_and_missing_active_term_are_rejected(self):
        self.auth(self.reg_token)
        sheets = self._sheets([
            ["pref.prof@example.com", "CS101", 1],
            ["PREF.PROF@example.com", "cs101", 2],
        ])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        messages = " ".join(e["message"] for e in response.data["errors"])
        self.assertIn("Duplicate professor", messages)
        self.assertIn("No active AcademicTerm", messages)

    def test_invalid_priority_is_rejected(self):
        self.auth(self.reg_token)
        self._active_term()
        sheets = self._sheets([["pref.prof@example.com", "CS101", "abc"]])
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(
            any(
                e["sheet"] == "ProfessorPreferences" and e["field"] == "priority"
                for e in response.data["errors"]
            )
        )

    def test_commit_rolls_back_when_active_term_disappears(self):
        self.auth(self.reg_token)
        term = self._active_term()
        sheets = {
            "Departments": [["id", "name"], [self.dept.id, "CS"], [None, "Rollback Dept"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"], [self.subject.id, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [["id", "email", "department_id"], [None, "rb.prof@example.com", self.dept.id]],
            "ProfessorPreferences": [
                ["professor_email", "subject_code", "priority"],
                ["rb.prof@example.com", "CS101", 1],
            ],
        }
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data.get("errors"))
        token = response.data["preview_token"]

        term.delete()
        commit = self.client.post(self.url_commit, {"preview_token": token}, format="json")
        self.assertEqual(commit.status_code, 400)
        self.assertFalse(commit.data["committed"])
        self.assertFalse(Department.objects.filter(name="Rollback Dept").exists())
        self.assertFalse(User.objects.filter(email__iexact="rb.prof@example.com").exists())
        self.assertEqual(ProfessorPreference.objects.count(), 0)

    def test_professor_without_department_is_rejected(self):
        self.auth(self.reg_token)
        self._active_term()
        orphan_user = get_user_model().objects.create_user(
            username="orphan.prof", email="orphan.prof@example.com"
        )
        Professors.objects.create(user=orphan_user)
        sheets = self._sheets(
            [
                ["orphan.prof@example.com", "CS101", 1],
                ["new.prof@example.com", "CS101", 1],
            ],
            professor_rows=[[None, "new.prof@example.com", None]],
        )
        xlsx = self._make_xlsx(sheets)
        response = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        fields = {
            e["field"]
            for e in response.data["errors"]
            if e["sheet"] == "ProfessorPreferences"
        }
        self.assertIn("department_id", fields)
        self.assertEqual(ProfessorPreference.objects.count(), 0)

    def test_null_section_duplicates_blocked_at_db_level(self):
        from django.db import IntegrityError, transaction

        self.auth(self.reg_token)
        term = self._active_term()
        sheets = self._sheets(
            [["pref.prof@example.com", "CS101", None]],
            professor_rows=[[None, "pref.prof@example.com", self.dept.id]],
        )
        xlsx = self._make_xlsx(sheets)
        first = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(first.status_code, 200, first.data.get("errors"))
        commit = self.client.post(
            self.url_commit, {"preview_token": first.data["preview_token"]}, format="json"
        )
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))
        pref = ProfessorPreference.objects.get(
            professor__user__email__iexact="pref.prof@example.com",
            term=term,
            section__isnull=True,
        )
        # PostgreSQL treats NULLs as distinct in plain unique_together; the
        # conditional constraint must still reject a second sectionless row.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ProfessorPreference.objects.create(
                    professor=pref.professor,
                    subject=pref.subject,
                    section=None,
                    term=term,
                    priority=9,
                )

    def test_reimport_updates_instead_of_duplicating(self):
        self.auth(self.reg_token)
        term = self._active_term()
        sheets = self._sheets(
            [["pref.prof@example.com", "CS101", None]],
            professor_rows=[[None, "pref.prof@example.com", self.dept.id]],
        )
        xlsx = self._make_xlsx(sheets)
        first = self.client.post(self.url_preview, {"file": xlsx}, format="multipart")
        self.assertEqual(first.status_code, 200, first.data.get("errors"))
        commit = self.client.post(
            self.url_commit, {"preview_token": first.data["preview_token"]}, format="json"
        )
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))

        # A fresh upload handle: the first BytesIO was consumed by the first POST.
        second_preview = self.client.post(
            self.url_preview, {"file": self._make_xlsx(sheets)}, format="multipart"
        )
        self.assertEqual(second_preview.status_code, 200, second_preview.data.get("errors"))
        items = second_preview.data["preview_items"]["ProfessorPreferences"]
        self.assertEqual([i["action"] for i in items], ["update"])
        second_commit = self.client.post(
            self.url_commit,
            {"preview_token": second_preview.data["preview_token"]},
            format="json",
        )
        self.assertEqual(second_commit.status_code, 200, second_commit.data.get("errors"))

        prof = Professors.objects.get(user__email__iexact="pref.prof@example.com")
        self.assertEqual(
            ProfessorPreference.objects.filter(professor=prof, term=term).count(), 1
        )
        submission = PreferenceSubmission.objects.get(term=term, department=self.dept)
        self.assertEqual(SubmissionItem.objects.filter(submission=submission).count(), 1)

    def _meeting_sheets(self, pref_rows, professor_rows=None):
        return {
            "Departments": [["id", "name"], [self.dept.id, "CS"]],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [["id", "code", "title"], [self.subject.id, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [
                ["id", "email", "department_id"],
                *(professor_rows or []),
            ],
            "ProfessorPreferences": [
                [
                    "professor_email",
                    "subject_code",
                    "priority",
                    "days",
                    "start_time",
                    "end_time",
                    "mode",
                ],
                *pref_rows,
            ],
        }

    def test_multiday_meetings_commit_and_sync_availability(self):
        self.auth(self.reg_token)
        term = self._active_term()
        sheets = self._meeting_sheets(
            [["pref.prof@example.com", "CS101", 1, "MWF", "08:00", "10:00", "sync"]],
            professor_rows=[[None, "pref.prof@example.com", self.dept.id]],
        )
        preview = self.client.post(
            self.url_preview, {"file": self._make_xlsx(sheets)}, format="multipart"
        )
        self.assertEqual(preview.status_code, 200, preview.data.get("errors"))
        commit = self.client.post(
            self.url_commit,
            {"preview_token": preview.data["preview_token"]},
            format="json",
        )
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))

        prof = Professors.objects.get(user__email__iexact="pref.prof@example.com")
        pref = ProfessorPreference.objects.get(professor=prof, term=term)
        self.assertEqual(len(pref.meetings), 3)
        self.assertEqual(
            [m["preferred_days"][0] for m in pref.meetings], [0, 2, 4]
        )
        self.assertTrue(all(m["duration_slots"] == 2 for m in pref.meetings))
        windows = AvailabilityWindow.objects.filter(prof=prof, is_preferred=True)
        self.assertEqual(windows.count(), 3)
        self.assertEqual(set(windows.values_list("day", flat=True)), {0, 2, 4})

    def test_missing_end_time_and_inverted_times_are_rejected(self):
        self.auth(self.reg_token)
        self._active_term()
        sheets = self._meeting_sheets(
            [
                ["a.prof@example.com", "CS101", 1, "MW", "08:00", None, "sync"],
                ["b.prof@example.com", "CS101", 1, "MW", "10:00", "09:00", "sync"],
            ],
            professor_rows=[
                [None, "a.prof@example.com", self.dept.id],
                [None, "b.prof@example.com", self.dept.id],
            ],
        )
        response = self.client.post(
            self.url_preview, {"file": self._make_xlsx(sheets)}, format="multipart"
        )
        self.assertEqual(response.status_code, 400)
        messages = " ".join(e["message"] for e in response.data["errors"])
        self.assertIn("must be provided together", messages)
        self.assertIn("start_time must be before end_time", messages)

    def test_batch_rollback_deletes_created_and_restores_updated(self):
        self.auth(self.reg_token)
        self._active_term()
        sheets = {
            "Departments": [
                ["id", "name"],
                [self.dept.id, "CS"],
                [None, "Rollback Dept"],
            ],
            "Rooms": [["id", "name", "capacity"]],
            "Subjects": [
                ["id", "code", "title"],
                [self.subject.id, "CS101", "Renamed Intro"],
            ],
            "Sections": [["id", "name", "headcount"]],
            "Professors": [["id", "email", "department_id"]],
        }
        preview = self.client.post(
            self.url_preview, {"file": self._make_xlsx(sheets)}, format="multipart"
        )
        self.assertEqual(preview.status_code, 200, preview.data.get("errors"))
        commit = self.client.post(
            self.url_commit,
            {"preview_token": preview.data["preview_token"]},
            format="json",
        )
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))
        batch_id = commit.data["batch_id"]
        self.assertIsNotNone(batch_id)
        self.assertTrue(Department.objects.filter(name="Rollback Dept").exists())
        self.subject.refresh_from_db()
        self.assertEqual(self.subject.title, "Renamed Intro")

        listed = self.client.get("/api/imports/batches/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data[0]["id"], batch_id)

        rollback = self.client.post(
            f"/api/imports/batches/{batch_id}/rollback/", format="json"
        )
        self.assertEqual(rollback.status_code, 200, rollback.data)
        self.assertFalse(Department.objects.filter(name="Rollback Dept").exists())
        self.subject.refresh_from_db()
        self.assertEqual(self.subject.title, "Intro")
        batch = ImportBatch.objects.get(pk=batch_id)
        self.assertEqual(batch.status, ImportBatch.Status.ROLLED_BACK)

    def test_rollback_blocked_when_referenced_by_schedule_run(self):
        from timetable.models import Assignment, ScheduledClass, ScheduleRun

        self.auth(self.reg_token)
        term = self._active_term()
        sheets = self._meeting_sheets(
            [["pref.prof@example.com", "CS101", 1, None, None, None, None]],
            professor_rows=[[None, "pref.prof@example.com", self.dept.id]],
        )
        preview = self.client.post(
            self.url_preview, {"file": self._make_xlsx(sheets)}, format="multipart"
        )
        self.assertEqual(preview.status_code, 200, preview.data.get("errors"))
        commit = self.client.post(
            self.url_commit,
            {"preview_token": preview.data["preview_token"]},
            format="json",
        )
        self.assertEqual(commit.status_code, 200, commit.data.get("errors"))
        batch_id = commit.data["batch_id"]

        prof = Professors.objects.get(user__email__iexact="pref.prof@example.com")
        assignment = Assignment.objects.create(
            prof=prof, subject=self.subject, section=self.section, term=term
        )
        run_obj = ScheduleRun.objects.create(
            algorithm="greedy", status="feasible", term=term
        )
        ScheduledClass.objects.create(
            run=run_obj,
            assignment=assignment,
            day=0,
            start_time=dtime(8, 0),
            duration_slots=1,
        )

        rollback = self.client.post(
            f"/api/imports/batches/{batch_id}/rollback/", format="json"
        )
        self.assertEqual(rollback.status_code, 400)
        self.assertIn("ScheduleRun", rollback.data["detail"])
        self.assertTrue(
            ProfessorPreference.objects.filter(professor=prof, term=term).exists()
        )
