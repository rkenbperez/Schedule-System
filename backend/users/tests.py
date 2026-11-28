from datetime import date

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from catalog.models import Department, Section, Subject
from timetable.models import AcademicTerm, Assignment

from .models import (
    PasswordResetToken,
    PreferenceSubmission,
    ProfessorPreference,
    Professors,
    SubmissionItem,
)
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


class UserRoleTests(APITestCase):
    """Role derivation shared by login and /api/auth/jwt/me/."""

    def setUp(self):
        cache.clear()
        self.head = User.objects.create_user(
            username="head1",
            email="head1@example.com",
            password="pass12345",
            first_name="Hedy",
            last_name="Head",
        )
        self.dept = Department.objects.create(name="Head Dept", head=self.head)
        Professors.objects.create(user=self.head, department=self.dept)

    def tearDown(self):
        cache.clear()

    def test_me_returns_department_head_role_and_department(self):
        self.client.force_authenticate(user=self.head)
        response = self.client.get(reverse("jwt-me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "department_head")
        self.assertEqual(
            response.data["department"], {"id": self.dept.id, "name": "Head Dept"}
        )

    def test_login_returns_department_head_role(self):
        response = self.client.post(
            reverse("jwt-login"),
            {"email": "head1@example.com", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], "department_head")
        self.assertEqual(
            response.data["user"]["department"]["id"], self.dept.id
        )

    def test_staff_head_of_department_stays_registrar(self):
        staff = User.objects.create_user(
            username="staffhead",
            email="staffhead@example.com",
            password="pass12345",
            is_staff=True,
        )
        Department.objects.create(name="Staff Dept", head=staff)
        self.client.force_authenticate(user=staff)
        response = self.client.get(reverse("jwt-me"))
        self.assertEqual(response.data["role"], "registrar")
        self.assertIsNone(response.data["department"])

    def test_plain_professor_role_unchanged(self):
        other = Department.objects.create(name="Other Dept")
        prof = User.objects.create_user(
            username="plainprof",
            email="plainprof@example.com",
            password="pass12345",
        )
        Professors.objects.create(user=prof, department=other)
        self.client.force_authenticate(user=prof)
        response = self.client.get(reverse("jwt-me"))
        self.assertEqual(response.data["role"], "professor")
        self.assertIsNone(response.data["department"])


class ProfessorsViewSetFilterTests(APITestCase):
    def setUp(self):
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.prof_a1 = self._make_professor("profa1", self.dept_a)
        self.prof_a2 = self._make_professor("profa2", self.dept_a)
        self.prof_b1 = self._make_professor("profb1", self.dept_b)
        self.client.force_authenticate(user=self.prof_a1.user)

    @staticmethod
    def _make_professor(username, department):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="pass12345",
            first_name="Test",
            last_name=username.upper(),
        )
        return Professors.objects.create(user=user, department=department)

    def _assign_active_term(self):
        term = AcademicTerm.objects.create(
            year=2026,
            semester=1,
            start_date="2026-01-05",
            end_date="2026-05-20",
            is_active=True,
        )
        subject = Subject.objects.create(code="UA101", title="Filter Subject")
        section = Section.objects.create(name="BSIT-1A", headcount=10, term=term)
        Assignment.objects.create(
            prof=self.prof_a1, subject=subject, section=section, term=term
        )
        return term

    def _listed_ids(self, query=None):
        response = self.client.get(reverse("prof-list"), query or {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["id"] for row in response.data["results"]}

    def test_department_filter_returns_only_that_department(self):
        ids = self._listed_ids({"department": self.dept_a.id})
        self.assertEqual(ids, {self.prof_a1.id, self.prof_a2.id})

    def test_department_filter_includes_professors_without_active_term_assignments(self):
        # Active term exists but only prof_a1 has an assignment in it; the
        # department filter must bypass the active-term default so prof_a2 is
        # still assignable by the department head.
        self._assign_active_term()
        ids = self._listed_ids({"department": self.dept_a.id})
        self.assertEqual(ids, {self.prof_a1.id, self.prof_a2.id})

    def test_department_and_term_filters_combine(self):
        term = self._assign_active_term()
        ids = self._listed_ids({"department": self.dept_a.id, "term": term.id})
        self.assertEqual(ids, {self.prof_a1.id})

    def test_default_list_still_scopes_to_active_term_assignments(self):
        self._assign_active_term()
        ids = self._listed_ids()
        self.assertEqual(ids, {self.prof_a1.id})

    def test_term_filter_alone_still_works(self):
        term = self._assign_active_term()
        ids = self._listed_ids({"term": term.id})
        self.assertEqual(ids, {self.prof_a1.id})

    def test_invalid_department_value_behaves_as_absent(self):
        # Malformed department must fall back to the default active-term
        # scoping, not leak the full unscoped professors table.
        self._assign_active_term()
        ids = self._listed_ids({"department": "not-a-number"})
        self.assertEqual(ids, {self.prof_a1.id})


class PreferenceReviewFlowTests(APITestCase):
    """Professor submit -> head review -> reject -> resubmit -> publish."""

    def setUp(self):
        self.dept = Department.objects.create(name="Review Dept")
        self.head = User.objects.create_user(
            username="reviewhead", email="head@example.com", password="pass12345"
        )
        self.dept.head = self.head
        self.dept.save()
        prof_user = User.objects.create_user(
            username="reviewprof", email="prof@example.com", password="pass12345"
        )
        self.prof = Professors.objects.create(user=prof_user, department=self.dept)
        self.term = AcademicTerm.objects.create(
            year=2026,
            semester=1,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 5, 1),
            is_active=True,
        )
        subject = Subject.objects.create(code="CS101", title="Intro to CS")
        section = Section.objects.create(name="BSCS 1-A", headcount=30)
        self.pref = ProfessorPreference.objects.create(
            professor=self.prof,
            subject=subject,
            section=section,
            term=self.term,
            meetings=[{"mode": "sync", "duration_slots": 2}],
        )
        self.submit_url = reverse("professor-preference-submit", args=[self.pref.id])
        self.publish_url = reverse("department-head-publish", args=[self.pref.id])
        self.submissions_url = reverse("department-head-submissions")
        self.prof_prefs_url = reverse("professor-preference-list")

    def _submit(self):
        self.client.force_authenticate(user=self.prof.user)
        return self.client.post(self.submit_url)

    def test_submit_creates_department_head_queue_item(self):
        response = self._submit()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PreferenceSubmission.objects.count(), 1)
        self.assertEqual(SubmissionItem.objects.count(), 1)
        item = SubmissionItem.objects.get()
        self.assertEqual(item.action, "publish")
        self.assertEqual(item.submission.department, self.dept)
        self.assertEqual(item.submission.term, self.term)

        self.client.force_authenticate(user=self.head)
        response = self.client.get(self.submissions_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = [i for sub in response.data["results"] for i in sub["items"]]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["preference"]["status"], "submitted")

    def test_reject_persists_notes_and_syncs_submission_item(self):
        self._submit()
        self.client.force_authenticate(user=self.head)
        response = self.client.post(
            self.publish_url,
            {"action": "reject", "notes": "Lab hours exceed policy."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pref.refresh_from_db()
        item = SubmissionItem.objects.get()
        self.assertEqual(self.pref.status, "rejected")
        self.assertEqual(self.pref.review_notes, "Lab hours exceed policy.")
        self.assertEqual(item.action, "reject")
        self.assertEqual(item.notes, "Lab hours exceed policy.")

        # The professor sees the reviewer notes in the list payload.
        self.client.force_authenticate(user=self.prof.user)
        response = self.client.get(self.prof_prefs_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data["results"][0]
        self.assertEqual(row["status"], "rejected")
        self.assertEqual(row["review_notes"], "Lab hours exceed policy.")

    def test_resubmit_clears_stale_rejection_state_without_duplicates(self):
        self._submit()
        self.client.force_authenticate(user=self.head)
        self.client.post(
            self.publish_url,
            {"action": "reject", "notes": "Needs changes."},
            format="json",
        )

        response = self._submit()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pref.refresh_from_db()
        item = SubmissionItem.objects.get()
        self.assertEqual(self.pref.status, "submitted")
        self.assertEqual(self.pref.review_notes, "")
        # Upsert, not duplicate: same submission/item rows are reused.
        self.assertEqual(PreferenceSubmission.objects.count(), 1)
        self.assertEqual(SubmissionItem.objects.count(), 1)
        self.assertEqual(item.action, "publish")
        self.assertEqual(item.notes, "")

    def test_publish_syncs_submission_item(self):
        self._submit()
        self.client.force_authenticate(user=self.head)
        response = self.client.post(self.publish_url, {"action": "publish"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pref.refresh_from_db()
        item = SubmissionItem.objects.get()
        self.assertEqual(self.pref.status, "published")
        self.assertEqual(item.action, "publish")

    def test_batch_reject_syncs_submission_items(self):
        self._submit()
        self.client.force_authenticate(user=self.head)
        response = self.client.post(
            reverse("department-head-batch-publish"),
            {"preference_ids": [self.pref.id], "action": "reject", "notes": "No."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pref.refresh_from_db()
        item = SubmissionItem.objects.get()
        self.assertEqual(self.pref.status, "rejected")
        self.assertEqual(item.action, "reject")
        self.assertEqual(item.notes, "No.")


class ProfessorPreferenceNullSectionTests(APITestCase):
    """Imported preferred-subject rows have section=None; the API contract
    must serialize them instead of dropping the field."""

    def setUp(self):
        dept = Department.objects.create(name="Null Section Dept")
        prof_user = User.objects.create_user(
            username="nullsec", email="nullsec@example.com", password="pass12345"
        )
        self.prof = Professors.objects.create(user=prof_user, department=dept)
        self.term = AcademicTerm.objects.create(
            year=2027,
            semester=1,
            start_date=date(2027, 1, 1),
            end_date=date(2027, 5, 1),
        )
        self.pref = ProfessorPreference.objects.create(
            professor=self.prof,
            subject=Subject.objects.create(code="CS999", title="Elective"),
            section=None,
            term=self.term,
        )

    def test_list_serializer_returns_null_section_name(self):
        from .serializers import ProfessorPreferenceListSerializer

        data = ProfessorPreferenceListSerializer(self.pref).data
        self.assertIsNone(data["section_name"])
        self.assertIsNone(data["section"])

    def test_detail_serializer_returns_null_section_name(self):
        from .serializers import ProfessorPreferenceSerializer

        data = ProfessorPreferenceSerializer(self.pref).data
        self.assertIsNone(data["section_name"])

    def test_duplicate_unsectioned_preference_rejected(self):
        self.client.force_authenticate(user=self.prof.user)
        url = reverse("professor-preference-list")
        payload = {
            "subject": self.pref.subject_id,
            "term": self.term.id,
            "meetings": [{"mode": "sync", "duration_slots": 2}],
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", str(response.data))


class ProfessorSetupLinkTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="registrar",
            email="registrar@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.dept = Department.objects.create(name="Setup Dept")
        self.prof_user = User.objects.create_user(
            username="newprof",
            email="newprof@example.com",
            password="oldpass123",
            is_active=True,
        )
        self.prof = Professors.objects.create(
            user=self.prof_user, department=self.dept
        )
        self.url = reverse("professor-setup-link", args=[self.prof.id])

    def test_registrar_can_generate_link(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("/reset-password?token=", response.data["setup_url"])
        self.assertIn("expires_at", response.data)

    def test_professor_cannot_generate_link(self):
        self.client.force_authenticate(user=self.prof_user)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_department_head_cannot_generate_link(self):
        self.dept.head = self.prof_user
        self.dept.save(update_fields=["head"])
        self.client.force_authenticate(user=self.prof_user)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_generate_link(self):
        response = self.client.post(self.url)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_inactive_professor_is_rejected(self):
        self.prof_user.is_active = False
        self.prof_user.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_link_token_works_with_password_reset_confirm(self):
        self.client.force_authenticate(user=self.staff)
        setup = self.client.post(self.url)
        token = setup.data["setup_url"].split("token=")[1]

        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse("password-reset-confirm", args=[token]),
            {"new_password": "brandnewpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.prof_user.refresh_from_db()
        self.assertTrue(self.prof_user.check_password("brandnewpass123"))


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="changepass",
            email="changepass@example.com",
            password="oldpass123",
        )
        self.url = reverse("change-password")
        self.client.force_authenticate(user=self.user)

    def test_changes_password(self):
        response = self.client.post(
            self.url,
            {"old_password": "oldpass123", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass456"))

    def test_rejects_wrong_old_password(self):
        response = self.client.post(
            self.url,
            {"old_password": "wrongpass", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_same_password(self):
        response = self.client.post(
            self.url,
            {"old_password": "oldpass123", "new_password": "oldpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_weak_new_password(self):
        response = self.client.post(
            self.url,
            {"old_password": "oldpass123", "new_password": "123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            self.url,
            {"old_password": "oldpass123", "new_password": "newpass456"},
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_unusable_password_returns_400(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])

        response = self.client.post(
            self.url,
            {"old_password": "oldpass123", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProfessorDepartmentHeadSerializerTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="registrar",
            email="registrar2@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.dept_a = Department.objects.create(name="Heads A")
        self.dept_b = Department.objects.create(name="Heads B")
        self.client.force_authenticate(user=self.staff)

    def test_create_assigns_department_and_head(self):
        response = self.client.post(
            "/api/profs/",
            {
                "user_email": "headcreate@example.com",
                "department_id": self.dept_a.id,
                "department_head": True,
                "max_daily_hours": 8,
                "max_consecutive": 4,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.dept_a.refresh_from_db()
        self.assertEqual(self.dept_a.head.email, "headcreate@example.com")

    def test_moving_head_with_flag_transfers_headship(self):
        user = User.objects.create_user(
            username="existinghead",
            email="existinghead@example.com",
            password="pass12345",
        )
        prof = Professors.objects.create(user=user, department=self.dept_a)
        self.dept_a.head = user
        self.dept_a.save(update_fields=["head"])

        response = self.client.patch(
            f"/api/profs/{prof.id}/",
            {"department_id": self.dept_b.id, "department_head": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.dept_a.refresh_from_db()
        self.dept_b.refresh_from_db()
        self.assertIsNone(self.dept_a.head_id)
        self.assertEqual(self.dept_b.head_id, user.id)

    def test_department_move_clears_stale_headship(self):
        user = User.objects.create_user(
            username="movinghead",
            email="movinghead@example.com",
            password="pass12345",
        )
        prof = Professors.objects.create(user=user, department=self.dept_a)
        self.dept_a.head = user
        self.dept_a.save(update_fields=["head"])

        response = self.client.patch(
            f"/api/profs/{prof.id}/",
            {"department_id": self.dept_b.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.dept_a.refresh_from_db()
        prof.refresh_from_db()
        self.assertIsNone(self.dept_a.head_id)
        self.assertEqual(prof.department_id, self.dept_b.id)

    def test_deactivating_head_clears_department(self):
        user = User.objects.create_user(
            username="inactivehead",
            email="inactivehead@example.com",
            password="pass12345",
        )
        self.dept_a.head = user
        self.dept_a.save(update_fields=["head"])

        user.is_active = False
        user.save(update_fields=["is_active"])

        self.dept_a.refresh_from_db()
        self.assertIsNone(self.dept_a.head_id)
