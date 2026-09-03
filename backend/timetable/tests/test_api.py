from datetime import datetime, time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import Department, Room, Section, Subject
from timetable.models import (
    Assignment,
    AvailabilityWindow,
    MeetingSlot,
    ScheduledClass,
    ScheduleRun,
)
from users.models import Professors

User = get_user_model()


def make_assignment(prof, subject, section, spec):
    assignment = Assignment.objects.create(prof=prof, subject=subject, section=section)
    MeetingSlot.objects.bulk_create(
        [
            MeetingSlot(
                assignment=assignment,
                order=order,
                mode=mode,
                duration_slots=duration,
            )
            for order, (mode, duration) in enumerate(spec, start=1)
        ]
    )
    return assignment


class ApiTestCase(APITestCase):
    def setUp(self):
        self.registrar = User.objects.create_user(
            username="reg", password="pass12345", is_staff=True
        )
        self.reg_token = Token.objects.create(user=self.registrar)

        self.dept = Department.objects.create(name="CS")
        self.prof_user = User.objects.create_user(username="prof1", password="pass12345")
        self.prof = Professors.objects.create(user=self.prof_user, department=self.dept)
        self.prof_token = Token.objects.create(user=self.prof_user)

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


class AuthTests(ApiTestCase):
    def test_unauthenticated_is_rejected(self):
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 401)


class CatalogApiTests(ApiTestCase):
    def test_registrar_can_create_room(self):
        self.auth(self.reg_token)
        response = self.client.post("/api/rooms/", {"name": "R101", "capacity": 40})
        self.assertEqual(response.status_code, 201)

    def test_non_staff_cannot_write_room(self):
        self.auth(self.prof_token)
        response = self.client.post("/api/rooms/", {"name": "R101", "capacity": 40})
        self.assertEqual(response.status_code, 403)

    def test_authenticated_can_read_rooms(self):
        Room.objects.create(name="R101", capacity=40)
        self.auth(self.prof_token)
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)


class DepartmentApiTests(ApiTestCase):
    def test_registrar_can_create_department(self):
        self.auth(self.reg_token)
        response = self.client.post("/api/departments/", {"name": "EE"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "EE")

    def test_non_staff_cannot_write_department(self):
        self.auth(self.prof_token)
        response = self.client.post("/api/departments/", {"name": "EE"})
        self.assertEqual(response.status_code, 403)

    def test_room_response_includes_department_name(self):
        Room.objects.create(name="R101", capacity=40, department=self.dept)
        self.auth(self.prof_token)
        response = self.client.get("/api/rooms/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["department"], self.dept.id)
        self.assertEqual(response.data[0]["department_name"], "CS")

    def test_prof_response_includes_department_name(self):
        self.auth(self.prof_token)
        response = self.client.get("/api/profs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["department"], self.dept.id)
        self.assertEqual(response.data[0]["department_name"], "CS")


class AvailabilityApiTests(ApiTestCase):
    def _payload(self, prof_id):
        return {
            "prof": prof_id,
            "day": 0,
            "start_time": "08:00:00",
            "end_time": "17:00:00",
            "is_preferred": False,
        }

    def test_prof_creates_own_availability(self):
        self.auth(self.prof_token)
        response = self.client.post("/api/availability-windows/", self._payload(self.prof.id))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)

    def test_prof_availability_is_forced_to_own(self):
        other_user = User.objects.create_user(username="prof2", password="pass12345")
        other = Professors.objects.create(user=other_user, department=self.dept)

        self.auth(self.prof_token)
        response = self.client.post("/api/availability-windows/", self._payload(other.id))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)

    def test_prof_only_sees_own_availability(self):
        other_user = User.objects.create_user(username="prof2", password="pass12345")
        other = Professors.objects.create(user=other_user, department=self.dept)
        AvailabilityWindow.objects.create(
            prof=other, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )

        self.auth(self.prof_token)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_user_without_prof_profile_gets_403(self):
        no_prof = User.objects.create_user(username="noprofile", password="pass12345")
        self.auth(Token.objects.create(user=no_prof))
        response = self.client.post("/api/availability-windows/", self._payload(self.prof.id))
        self.assertEqual(response.status_code, 403)


class ScheduleGenerateTests(ApiTestCase):
    def _seed(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        make_assignment(
            self.prof, subject, section, [("sync", 1), ("async", 1)]
        )
        AvailabilityWindow.objects.create(
            prof=self.prof, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )

    def test_generate_happy_path(self):
        self._seed()
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["feasible"])
        self.assertEqual(response.data["class_count"], 2)

        run = ScheduleRun.objects.get(pk=response.data["run_id"])
        self.assertEqual(run.algorithm, "greedy")
        self.assertEqual(run.classes.count(), 2)

    def test_generate_invalid_algorithm(self):
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "nope"})
        self.assertEqual(response.status_code, 400)

    def test_generate_requires_registrar(self):
        self._seed()
        self.auth(self.prof_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(response.status_code, 403)

    def test_infeasible_input_returns_status_not_error(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        make_assignment(self.prof, subject, section, [("sync", 1)])
        # No availability -> infeasible.
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["feasible"])
        self.assertEqual(response.data["status"], "infeasible")
        self.assertTrue(any("not placed" in v for v in response.data["violations"]))

    def test_generate_rolls_back_on_class_save_failure(self):
        self._seed()
        self.auth(self.reg_token)
        with patch.object(
            ScheduledClass.objects, "bulk_create", side_effect=Exception("boom")
        ):
            with self.assertRaises(Exception):
                self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(ScheduleRun.objects.count(), 0)

    def test_generate_places_classes_with_per_slot_duration_and_mode(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        make_assignment(self.prof, subject, section, [("lab", 3), ("sync", 2)])
        AvailabilityWindow.objects.create(
            prof=self.prof, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["feasible"])
        self.assertEqual(response.data["class_count"], 2)

        run = ScheduleRun.objects.get(pk=response.data["run_id"])
        durations = sorted(run.classes.values_list("duration_slots", flat=True))
        self.assertEqual(durations, [2, 3])
        modes = sorted(run.classes.values_list("mode", flat=True))
        self.assertEqual(modes, ["lab", "sync"])


class AssignmentApiTests(ApiTestCase):
    def _payload(self, prof_id, subject_id, section_id, meetings):
        return {
            "prof": prof_id,
            "subject": subject_id,
            "section": section_id,
            "meetings": meetings,
        }

    def _seed_ids(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        return subject.id, section.id

    def test_meeting_defaults_mode_sync(self):
        subject_id, section_id = self._seed_ids()
        self.auth(self.reg_token)
        response = self.client.post(
            "/api/assignments/",
            self._payload(self.prof.id, subject_id, section_id, [{"duration_slots": 1}]),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["meetings"]), 1)
        self.assertEqual(response.data["meetings"][0]["mode"], "sync")

    def test_meeting_defaults_duration_from_mode(self):
        subject_id, section_id = self._seed_ids()
        self.auth(self.reg_token)
        response = self.client.post(
            "/api/assignments/",
            self._payload(self.prof.id, subject_id, section_id, [{"mode": "async"}]),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["meetings"]), 1)
        self.assertEqual(response.data["meetings"][0]["duration_slots"], 1)

    def test_explicit_duration_overrides_mode_default(self):
        subject_id, section_id = self._seed_ids()
        self.auth(self.reg_token)
        response = self.client.post(
            "/api/assignments/",
            self._payload(
                self.prof.id,
                subject_id,
                section_id,
                [{"mode": "async", "duration_slots": 2}],
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["meetings"]), 1)
        self.assertEqual(response.data["meetings"][0]["duration_slots"], 2)


class ScheduleViewTests(ApiTestCase):
    def _seed_and_generate(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        make_assignment(self.prof, subject, section, [("sync", 1)])
        AvailabilityWindow.objects.create(
            prof=self.prof, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        return response.data["run_id"]

    def test_prof_sees_only_own_classes(self):
        run_id = self._seed_and_generate()

        other_user = User.objects.create_user(username="prof2", password="pass12345")
        other = Professors.objects.create(user=other_user, department=self.dept)

        self.auth(Token.objects.create(user=other_user))
        response = self.client.get(f"/api/schedules/runs/{run_id}/classes")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_my_endpoint_returns_own_schedule(self):
        self._seed_and_generate()
        self.auth(self.prof_token)
        response = self.client.get("/api/schedules/my")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["prof_id"], self.prof.id)

    def test_runs_list_requires_registrar(self):
        self._seed_and_generate()
        self.auth(self.prof_token)
        response = self.client.get("/api/schedules/runs")
        self.assertEqual(response.status_code, 403)

    def test_classes_filter_rejects_non_integer(self):
        run_id = self._seed_and_generate()
        self.auth(self.reg_token)
        response = self.client.get(f"/api/schedules/runs/{run_id}/classes?prof=abc")
        self.assertEqual(response.status_code, 400)
        response = self.client.get(f"/api/schedules/runs/{run_id}/classes?day=abc")
        self.assertEqual(response.status_code, 400)

    def test_classes_include_end_time(self):
        run_id = self._seed_and_generate()
        self.auth(self.reg_token)
        response = self.client.get(f"/api/schedules/runs/{run_id}/classes")
        self.assertEqual(response.status_code, 200)
        for klass in response.data:
            self.assertIn("end_time", klass)
            start = datetime.strptime(klass["start_time"], "%H:%M:%S").time()
            expected_end = (
                datetime.combine(datetime.today(), start)
                + timedelta(hours=klass["duration_slots"])
            ).time()
            actual_end = datetime.strptime(klass["end_time"], "%H:%M:%S").time()
            self.assertEqual(actual_end, expected_end)


class FullScheduleFlowTests(ApiTestCase):
    """End-to-end: login -> catalog -> load -> generate -> read, over real HTTP."""

    def _login(self, username, password):
        response = self.client.post(
            "/api/auth/login/", {"username": username, "password": password}
        )
        self.assertEqual(response.status_code, 200)
        token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        return token

    def _post(self, url, payload, expected=201):
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, expected, response.data)
        return response.data

    def _seed(self):
        self._login("reg", "pass12345")

        subj1 = self._post(
            "/api/subjects/", {"code": "CS101", "title": "Algorithms", "units": 3}
        )
        subj2 = self._post(
            "/api/subjects/", {"code": "CS102", "title": "Databases", "units": 3}
        )
        sec1 = self._post("/api/sections/", {"name": "BSIT-3A", "headcount": 30})
        sec2 = self._post("/api/sections/", {"name": "BSIT-3B", "headcount": 25})
        it_dept = self._post("/api/departments/", {"name": "IT"})
        room1 = self._post("/api/rooms/", {"name": "R201", "capacity": 40})
        room2 = self._post(
            "/api/rooms/", {"name": "R202", "capacity": 40, "department": it_dept["id"]}
        )

        prof2_user = User.objects.create_user(username="e2eprof2", password="pass12345")
        prof2 = self._post(
            "/api/profs/", {"user": prof2_user.id, "department": it_dept["id"]}
        )
        self._post(
            "/api/assignments/",
            {
                "prof": self.prof.id,
                "subject": subj1["id"],
                "section": sec1["id"],
                "meetings": [{"mode": "sync"}, {"mode": "async"}],
            },
        )
        self._post(
            "/api/assignments/",
            {
                "prof": prof2["id"],
                "subject": subj2["id"],
                "section": sec2["id"],
                "meetings": [{"mode": "sync"}, {"mode": "async"}],
            },
        )

        for prof_id in (self.prof.id, prof2["id"]):
            for day in range(5):
                self._post(
                    "/api/availability-windows/",
                    {
                        "prof": prof_id,
                        "day": day,
                        "start_time": "07:00:00",
                        "end_time": "19:00:00",
                        "is_preferred": True,
                    },
                )

        return prof2

    def test_full_schedule_creation_flow(self):
        prof2 = self._seed()

        metrics = {}
        for algorithm in ["greedy", "min_conflicts", "backtracking"]:
            result = self._post(
                "/api/schedules/generate", {"algorithm": algorithm}
            )
            self.assertTrue(result["feasible"], result)
            self.assertEqual(result["status"], "feasible")
            self.assertEqual(result["class_count"], 4)
            self.assertEqual(result["violations"], [])
            self.assertGreaterEqual(result["runtime_ms"], 0)
            self.assertIsNotNone(result["soft_score"])

            response = self.client.get(
                f"/api/schedules/runs/{result['run_id']}/classes"
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data), 4)
            metrics[algorithm] = result

        for algorithm, result in metrics.items():
            self.assertIn(algorithm, ["greedy", "min_conflicts", "backtracking"])

        self._login("e2eprof2", "pass12345")
        response = self.client.get("/api/schedules/my")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertTrue(all(c["prof_id"] == prof2["id"] for c in response.data))
