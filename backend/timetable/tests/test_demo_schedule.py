import io
import json
from datetime import date
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from catalog.models import Department, Section, Subject
from timetable.management.commands.demo_schedule import (
    Command,
    DEMO_PASSWORD,
    _dataset,
)
from timetable.models import (
    AcademicTerm,
    Assignment,
    GlobalSettings,
)
from users.models import Professors


User = get_user_model()


class DemoScheduleCommandTests(TestCase):
    def test_seed_users_reconciles_registrar_and_professor_department(self):
        registrar = User.objects.create_user(
            username="demoreg", password="wrong-password", is_staff=False
        )
        professor_user = User.objects.create_user(
            username="demo_prof1", password="professor-password"
        )
        old_department = Department.objects.create(name="OLD")
        professor = Professors.objects.create(
            user=professor_user, department=old_department
        )

        Command()._seed_users("normal")

        registrar.refresh_from_db()
        professor_user.refresh_from_db()
        professor.refresh_from_db()
        self.assertTrue(registrar.is_staff)
        self.assertTrue(registrar.check_password(DEMO_PASSWORD))
        self.assertTrue(professor_user.check_password("professor-password"))
        self.assertEqual(professor.department.name, "CS")

    @patch("timetable.management.commands.demo_schedule._dataset")
    def test_seed_uses_configured_mode_defaults(self, dataset):
        dataset.return_value = {
            "subjects": [("CC101", "Programming Fundamentals")],
            "sections": [("BSIT-1A", 30)],
            "availability": {
                "demo_prof1": [(0, "07:00:00", "19:00:00", True)]
            },
            "loads": [
                (
                    "demo_prof1",
                    "CC101",
                    "BSIT-1A",
                    [
                        ("sync", None),
                        ("lab", None),
                        ("async", None),
                        ("sync", 6),
                    ],
                )
            ],
        }
        term = AcademicTerm.objects.create(
            year=2025,
            semester=1,
            start_date=date(2025, 8, 1),
            end_date=date(2025, 12, 15),
            is_active=True,
        )
        department = Department.objects.create(name="CS")
        professor_user = User.objects.create_user(
            username="demo_prof1", password="professor-password"
        )
        Professors.objects.create(user=professor_user, department=department)
        Subject.objects.create(code="CC101", title="Programming Fundamentals")
        Section.objects.create(
            name="BSIT-1A",
            headcount=30,
            program="BSIT",
            year_level=1,
            term=term,
        )
        GlobalSettings.set("async_duration_default", 2)
        GlobalSettings.set("sync_duration_default", 4)
        GlobalSettings.set("lab_duration_default", 5)

        Command()._seed_load_and_availability("normal", term)

        assignment = Assignment.objects.get(
            prof=professor_user.prof,
            subject__code="CC101",
            section__name="BSIT-1A",
        )
        self.assertEqual(
            list(
                assignment.meetings.order_by("order").values_list(
                    "mode", "duration_slots"
                )
            ),
            [("sync", 4), ("lab", 5), ("async", 2), ("sync", 6)],
        )

    def test_demo_fixture_delegates_durations_to_mode_defaults(self):
        for scale in ("normal", "large", "full"):
            for _username, _code, _section, spec in _dataset(scale)["loads"]:
                with self.subTest(scale=scale, spec=spec):
                    self.assertTrue(spec)
                    for mode, duration in spec:
                        self.assertIn(mode, ("sync", "lab", "async"))
                        self.assertIsNone(duration)

    @patch("timetable.management.commands.demo_schedule.urllib.request.urlopen")
    def test_http_uses_finite_timeout(self, urlopen):
        response = MagicMock()
        response.read.return_value = json.dumps({"ok": True}).encode()
        urlopen.return_value.__enter__.return_value = response

        self.assertEqual(Command()._http("http://example.test", "GET", "/status"), {"ok": True})
        urlopen.assert_called_once()
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 60)

    @override_settings(DEBUG=True)
    def test_handle_stops_before_requesting_classes_when_all_results_infeasible(self):
        command = Command(stdout=io.StringIO(), stderr=io.StringIO())
        result = {
            "run_id": 1,
            "algorithm": "greedy",
            "feasible": False,
            "runtime_ms": 1.0,
            "soft_score": None,
            "class_count": 0,
            "violations": ["No valid placement"],
        }
        with patch.object(command, "_seed_users") as seed_users, patch.object(
            command, "_seed_catalog"
        ), patch.object(command, "_seed_load_and_availability"), patch.object(
            command, "_reconcile"
        ), patch.object(command, "_http") as http:
            seed_users.return_value.username = "demoreg"
            http.side_effect = [{"token": "local-token"}] + [result] * 3
            command.handle(
                base="http://example.test/api",
                reset=False,
                allow_non_debug=False,
                scale="normal",
                algorithm=None,
                time_limit=None,
                section=None,
            )

        self.assertEqual(http.call_count, 4)
        self.assertIn("No valid placement", command.stdout.getvalue())
