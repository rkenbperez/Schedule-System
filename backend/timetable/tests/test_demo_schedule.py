import io
import json
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from catalog.models import Department
from timetable.management.commands.demo_schedule import Command, DEMO_PASSWORD
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
            )

        self.assertEqual(http.call_count, 4)
        self.assertIn("No valid placement", command.stdout.getvalue())
