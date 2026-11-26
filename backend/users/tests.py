from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalog.models import Department
from .models import Professors
from .services import provision_professor


class LoginAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="prof1", email="prof1@example.com", password="pass12345"
        )
        dept = Department.objects.create(name="CCS")
        Professors.objects.create(user=self.user, department=dept)
        self.url = reverse("jwt-login")
        self.credentials = {"email": "prof1@example.com", "password": "pass12345"}

    def tearDown(self):
        cache.clear()

    def test_login_returns_token(self):
        response = self.client.post(self.url, self.credentials, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["username"], "prof1")
        self.assertEqual(response.data["user"]["role"], "professor")

    def test_login_wrong_password(self):
        response = self.client.post(
            self.url,
            {"email": "prof1@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_throttled_after_limit(self):
        for _ in range(10):
            self.client.post(self.url, self.credentials, format="json")
        response = self.client.post(self.url, self.credentials, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class ProvisionProfessorServiceTests(TestCase):
    def setUp(self):
        # Migration 0004 seeds a demo_admin user; assert against deltas.
        self.baseline_users = User.objects.count()
        self.baseline_professors = Professors.objects.count()

    def test_new_email_creates_user_and_profile(self):
        result = provision_professor(
            email="  New.Prof@Example.COM ",
            first_name="Juan",
            last_name="Dela Cruz",
        )
        self.assertEqual(result.action, "created")
        self.assertTrue(result.user_created)
        self.assertTrue(result.professor_created)

        user = User.objects.get(email__iexact="new.prof@example.com")
        self.assertEqual(user.email, "new.prof@example.com")
        self.assertTrue(user.is_active)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.first_name, "Juan")
        self.assertEqual(user.last_name, "Dela Cruz")

        prof = Professors.objects.get(user=user)
        self.assertEqual(prof.max_daily_hours, 8)  # model default
        self.assertEqual(prof.max_consecutive, 4)  # model default

    def test_existing_email_updates_without_password_reset(self):
        user = User.objects.create_user(
            username="prof1",
            email="Prof@Example.com",
            first_name="Old",
            last_name="Name",
            password="pass12345",
        )
        Professors.objects.create(user=user, max_daily_hours=8, max_consecutive=4)
        dept = Department.objects.create(name="CS")
        old_password = user.password

        result = provision_professor(
            email="PROF@EXAMPLE.COM",
            first_name="New",
            last_name="Name",
            department_id=dept.id,
            max_daily_hours=6,
            max_consecutive=3,
        )

        self.assertEqual(result.action, "updated")
        self.assertFalse(result.user_created)
        self.assertFalse(result.professor_created)
        self.assertEqual(User.objects.count(), self.baseline_users + 1)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 1)

        user.refresh_from_db()
        # create_user normalizes the domain part; the service must leave it as-is.
        self.assertEqual(user.email, "Prof@example.com")  # email untouched
        self.assertEqual(user.password, old_password)  # password untouched
        self.assertTrue(user.check_password("pass12345"))
        self.assertEqual(user.first_name, "New")
        self.assertEqual(user.last_name, "Name")

        prof = Professors.objects.get(user=user)
        self.assertEqual(prof.department, dept)
        self.assertEqual(prof.max_daily_hours, 6)
        self.assertEqual(prof.max_consecutive, 3)

    def test_existing_user_without_profile_gets_profile_only(self):
        user = User.objects.create_user(
            username="solo", email="solo@example.com", password="pass12345"
        )

        result = provision_professor(email="solo@example.com", max_daily_hours=5)

        self.assertFalse(result.user_created)
        self.assertTrue(result.professor_created)
        self.assertEqual(User.objects.count(), self.baseline_users + 1)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 1)
        prof = Professors.objects.get(user=user)
        self.assertEqual(prof.max_daily_hours, 5)

    def test_provision_is_idempotent(self):
        provision_professor(
            email="jdoe@example.com",
            first_name="John",
            last_name="Doe",
            max_daily_hours=6,
        )
        result = provision_professor(
            email="jdoe@example.com",
            first_name="John",
            last_name="Doe",
            max_daily_hours=6,
        )

        self.assertEqual(result.action, "updated")
        self.assertEqual(User.objects.count(), self.baseline_users + 1)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 1)
        prof = Professors.objects.get(user__email="jdoe@example.com")
        self.assertEqual(prof.max_daily_hours, 6)

    def test_dry_run_performs_no_writes(self):
        user = User.objects.create_user(
            username="prof1", email="prof1@example.com", password="pass12345"
        )
        Professors.objects.create(user=user, max_daily_hours=8)
        dept = Department.objects.create(name="CS")

        dry = provision_professor(
            email="prof1@example.com",
            first_name="Changed",
            department_id=dept.id,
            max_daily_hours=6,
            dry_run=True,
        )
        self.assertEqual(dry.action, "updated")
        self.assertEqual(User.objects.count(), self.baseline_users + 1)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 1)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "")
        self.assertEqual(
            Professors.objects.get(user=user).max_daily_hours, 8
        )

        dry_new = provision_professor(email="brand.new@example.com", dry_run=True)
        self.assertEqual(dry_new.action, "created")
        self.assertTrue(dry_new.user_created)
        self.assertTrue(dry_new.professor_created)
        self.assertEqual(User.objects.count(), self.baseline_users + 1)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 1)

        real = provision_professor(email="brand.new@example.com")
        self.assertEqual(real.action, dry_new.action)
        self.assertEqual(User.objects.count(), self.baseline_users + 2)
        self.assertEqual(Professors.objects.count(), self.baseline_professors + 2)

    def test_provision_error_cases(self):
        User.objects.create_user(username="a", email="dup@example.com", password="x")
        User.objects.create_user(username="b", email="DUP@example.com", password="x")

        with self.assertRaises(ValueError):
            provision_professor(email="dup@example.com")
        with self.assertRaises(ValueError):
            provision_professor(email="   ")
        with self.assertRaises(ValueError):
            provision_professor(email="not-an-email")
        with self.assertRaises(ValueError):
            provision_professor(email="ok@example.com", department_id=99999)

        # Nothing was created by the failed calls.
        self.assertEqual(User.objects.count(), self.baseline_users + 2)
        self.assertEqual(Professors.objects.count(), self.baseline_professors)
        self.assertFalse(User.objects.filter(email__iexact="ok@example.com").exists())

    def test_username_collision_gets_suffix(self):
        User.objects.create_user(username="jdoe", email="other@example.com", password="x")

        result = provision_professor(
            email="jdoe@example.com", first_name="Jane", last_name="Doe"
        )

        self.assertEqual(result.action, "created")
        self.assertNotEqual(result.user.username, "jdoe")
        self.assertTrue(result.user.username.startswith("jdoe"))
        self.assertEqual(
            User.objects.filter(username=result.user.username).count(), 1
        )
