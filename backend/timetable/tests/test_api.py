from datetime import time

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import Room, Section, Subject
from timetable.models import Assignment, AvailabilityWindow, ScheduleRun
from users.models import Professors

User = get_user_model()


class ApiTestCase(APITestCase):
    def setUp(self):
        self.registrar = User.objects.create_user(
            username="reg", password="pass12345", is_staff=True
        )
        self.reg_token = Token.objects.create(user=self.registrar)

        self.prof_user = User.objects.create_user(username="prof1", password="pass12345")
        self.prof = Professors.objects.create(user=self.prof_user, department="CS")
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
        other = Professors.objects.create(user=other_user, department="CS")

        self.auth(self.prof_token)
        response = self.client.post("/api/availability-windows/", self._payload(other.id))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["prof"], self.prof.id)

    def test_prof_only_sees_own_availability(self):
        other_user = User.objects.create_user(username="prof2", password="pass12345")
        other = Professors.objects.create(user=other_user, department="CS")
        AvailabilityWindow.objects.create(
            prof=other, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )

        self.auth(self.prof_token)
        response = self.client.get("/api/availability-windows/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)


class ScheduleGenerateTests(ApiTestCase):
    def _seed(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        Assignment.objects.create(
            prof=self.prof, subject=subject, section=section, meetings_per_week=2
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
        Assignment.objects.create(
            prof=self.prof, subject=subject, section=section, meetings_per_week=1
        )
        # No availability -> infeasible.
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["feasible"])
        self.assertEqual(response.data["status"], "infeasible")
        self.assertTrue(any("not placed" in v for v in response.data["violations"]))


class ScheduleViewTests(ApiTestCase):
    def _seed_and_generate(self):
        subject = Subject.objects.create(code="CC101", title="Intro", units=3)
        section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R101", capacity=40)
        Assignment.objects.create(
            prof=self.prof, subject=subject, section=section, meetings_per_week=1
        )
        AvailabilityWindow.objects.create(
            prof=self.prof, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )
        self.auth(self.reg_token)
        response = self.client.post("/api/schedules/generate", {"algorithm": "greedy"})
        return response.data["run_id"]

    def test_prof_sees_only_own_classes(self):
        run_id = self._seed_and_generate()

        other_user = User.objects.create_user(username="prof2", password="pass12345")
        other = Professors.objects.create(user=other_user, department="CS")

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
