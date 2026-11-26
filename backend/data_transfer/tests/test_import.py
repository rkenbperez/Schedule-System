import io
import csv
import zipfile
from io import BytesIO
from datetime import time as dtime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from openpyxl import load_workbook
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import Department, Room, Section, Subject
from timetable.models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    GlobalSettings,
    MeetingSlot,
)
from users.models import Professors

from data_transfer.import_utils import processor, parse_time, parse_day, parse_mode

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
            "Departments": [["id", "name"], [1, "Valid Dept"]],
            "Rooms": [["id", "name", "capacity"], [1, "R101", 40]],
            "Subjects": [["id", "code", "title"], [1, "CS101", "Intro"]],
            "Sections": [["id", "name", "headcount"], [1, "BSIT-3A", 30]],
            "Professors": [["id", "user_id"], [1, self.prof_user.id]],
            "Assignments": [["id", "professor_id", "subject_id", "section_id"], [1, 1, 1, 1]],
            "Meetings": [["id", "assignment_id", "order", "mode"], [1, 1, 1, "sync"]],
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
            "Departments", "Rooms", "Subjects", "Sections", "Professors", "Instructions"
        ]))

        for sheet_name in ["Departments", "Rooms", "Subjects", "Sections", "Professors"]:
            ws = wb[sheet_name]
            self.assertGreaterEqual(ws.max_row, 2)  # header + DB/sample rows
            self.assertEqual(ws.cell(row=1, column=1).value, "id")

        # Professors sheet is email-based; Sections has the program column.
        prof_headers = [cell.value for cell in wb["Professors"][1]]
        self.assertIn("email", prof_headers)
        self.assertNotIn("user_id", prof_headers)
        self.assertIn("program", [cell.value for cell in wb["Sections"][1]])

        # Rows come from the live database (setUp creates BSIT-3A).
        sections = [
            row[1]
            for row in wb["Sections"].iter_rows(min_row=2, values_only=True)
        ]
        self.assertIn("BSIT-3A", sections)

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
            self.assertIn("Instructions.txt", names)
            self.assertEqual(len(names), 6)  # 5 CSVs + Instructions.txt

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

    def test_generate_template_xlsx(self):
        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))
        self.assertEqual(set(wb.sheetnames), set([
            "Departments", "Rooms", "Subjects", "Sections", "Professors", "Instructions"
        ]))

        sections_ws = wb["Sections"]
        headers = [cell.value for cell in sections_ws[1]]
        self.assertIn("headcount", headers)
        self.assertIn("program", headers)
        sample_headcount = [
            row[headers.index("headcount")]
            for row in sections_ws.iter_rows(min_row=2, values_only=True)
            if row[headers.index("headcount")] not in (None, "")
        ]
        self.assertTrue(sample_headcount)

    def test_generate_template_csv_zip(self):
        content = processor.generate_template_csv_zip()
        with zipfile.ZipFile(BytesIO(content), "r") as zf:
            names = zf.namelist()
            for sheet in ["Departments", "Rooms", "Subjects", "Sections", "Professors"]:
                self.assertIn(f"{sheet}.csv", names)
            self.assertIn("Instructions.txt", names)
            self.assertEqual(len(names), 6)  # 5 CSVs + Instructions.txt

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


class ImportTemplateBehaviorTests(ImportTestCase):
    def test_roundtrip_generated_template_previews_valid(self):
        self.auth(self.reg_token)
        # Give the professors emails so the generated Professors rows
        # satisfy the email-or-user_id rule.
        self.prof_user.email = "prof1@example.com"
        self.prof_user.save()
        self.prof_user2.email = "prof2@example.com"
        self.prof_user2.save()

        # openpyxl-generated formulas carry no cached values; the parser
        # must ignore the read-only display columns regardless.
        content = processor.generate_template_xlsx()
        buf = BytesIO(content)
        buf.name = "template.xlsx"
        response = self.client.post(self.url_preview, {"file": buf}, format="multipart")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"], response.data.get("errors"))
        self.assertEqual(response.data["summary"]["updates"], 6)
        self.assertEqual(response.data["summary"]["creates"], 0)

    def test_template_professors_header_only_when_db_empty(self):
        Professors.objects.all().delete()
        Room.objects.all().delete()
        Subject.objects.all().delete()
        Section.objects.all().delete()
        Department.objects.all().delete()

        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))

        prof_ws = wb["Professors"]
        self.assertEqual(prof_ws.cell(row=1, column=1).value, "id")
        self.assertIn("email", [c.value for c in prof_ws[1]])
        self.assertEqual(prof_ws.max_row, 1)  # header row only, no data rows

        # Other sheets fall back to the sample rows.
        for sheet_name in ["Departments", "Rooms", "Subjects", "Sections"]:
            self.assertGreaterEqual(wb[sheet_name].max_row, 2)
        self.assertIn(
            "BSCS 3-A",
            [
                row[1]
                for row in wb["Sections"].iter_rows(min_row=2, values_only=True)
            ],
        )

    def test_template_rooms_include_db_rows_and_formula(self):
        content = processor.generate_template_xlsx()
        wb = load_workbook(BytesIO(content))

        rooms_ws = wb["Rooms"]
        headers = [c.value for c in rooms_ws[1]]
        self.assertEqual(
            headers,
            ["id", "name", "capacity", "department_id", "department_name"],
        )
        room_row = next(
            row
            for row in rooms_ws.iter_rows(min_row=2, values_only=True)
            if row[1] == self.room.name
        )
        self.assertEqual(room_row[0], self.room.id)
        self.assertEqual(room_row[3], self.dept.id)
        self.assertTrue(str(room_row[4]).startswith("=IFERROR("))

        prof_headers = [c.value for c in wb["Professors"][1]]
        self.assertEqual(
            prof_headers,
            [
                "id", "email", "first_name", "last_name", "department_id",
                "max_hours", "max_consecutive", "department_name",
            ],
        )