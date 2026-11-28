from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Professors

from .models import Department, ProfessorSubject, Room, Section, Subject


class CatalogModelTests(TestCase):
    def test_subject_str(self):
        subject = Subject.objects.create(code="CC101", title="Intro to Computing", units=3)
        self.assertEqual(str(subject), "CC101 - Intro to Computing")

    def test_room_str(self):
        room = Room.objects.create(name="Lab A", capacity=40)
        self.assertEqual(str(room), "Lab A (cap 40)")

    def test_section_created(self):
        section = Section.objects.create(name="BSIT-3A", headcount=40)
        self.assertEqual(Section.objects.count(), 1)
        self.assertEqual(str(section), "BSIT-3A")

    def test_section_program_derived_from_name(self):
        section = Section.objects.create(name="BSCS 3-A", headcount=40)
        self.assertEqual(section.program, "BSCS")
        explicit = Section.objects.create(name="BSIT-1A", headcount=40, program="CUSTOM")
        self.assertEqual(explicit.program, "CUSTOM")


class DepartmentHeadConstraintTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username="registrar",
            email="registrar@example.com",
            password="pass12345",
            is_staff=True,
        )
        self.dept_a = Department.objects.create(name="Dept A")
        self.dept_b = Department.objects.create(name="Dept B")
        self.user_a = self._make_professor("profa", self.dept_a)
        self.user_b = self._make_professor("profb", self.dept_b)

    @staticmethod
    def _make_professor(username, department):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="pass12345",
            is_active=True,
        )
        Professors.objects.create(user=user, department=department)
        return user

    def test_database_rejects_second_department_for_same_head(self):
        self.dept_a.head = self.user_a
        self.dept_a.save(update_fields=["head"])

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.dept_b.head = self.user_a
                self.dept_b.save(update_fields=["head"])

    def test_assigns_head(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            reverse("department-detail", args=[self.dept_a.id]),
            {"head": self.user_a.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.dept_a.refresh_from_db()
        self.assertEqual(self.dept_a.head_id, self.user_a.id)

    def test_unassigns_head(self):
        self.dept_a.head = self.user_a
        self.dept_a.save(update_fields=["head"])

        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            reverse("department-detail", args=[self.dept_a.id]),
            {"head": None},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.dept_a.refresh_from_db()
        self.assertIsNone(self.dept_a.head_id)

    def test_rejects_head_from_another_department(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            reverse("department-detail", args=[self.dept_b.id]),
            {"head": self.user_a.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.dept_b.refresh_from_db()
        self.assertIsNone(self.dept_b.head_id)

    def test_rejects_user_without_professor_profile(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            reverse("department-detail", args=[self.dept_a.id]),
            {"head": self.staff.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_head_of_another_department(self):
        self.dept_a.head = self.user_a
        self.dept_a.save(update_fields=["head"])
        self.user_a.prof.department = self.dept_b
        self.user_a.prof.save(update_fields=["department"])

        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            reverse("department-detail", args=[self.dept_b.id]),
            {"head": self.user_a.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_department_list_query_count_is_constant(self):
        self.dept_a.head = self.user_a
        self.dept_a.save(update_fields=["head"])
        self.dept_b.head = self.user_b
        self.dept_b.save(update_fields=["head"])
        self.client.force_authenticate(user=self.staff)

        with CaptureQueriesContext(connection) as initial:
            response = self.client.get(reverse("department-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for index in range(3):
            department = Department.objects.create(name=f"Dept Extra {index}")
            professor = self._make_professor(f"extra{index}", department)
            department.head = professor
            department.save(update_fields=["head"])

        with CaptureQueriesContext(connection) as expanded:
            response = self.client.get(reverse("department-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(expanded), len(initial))


class ProfessorSubjectModalityTests(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Modality Dept")
        user = User.objects.create_user(
            username="depthead", email="head@example.com", password="pass12345"
        )
        self.dept.head = user
        self.dept.save(update_fields=["head"])
        self.client.force_authenticate(user=user)
        prof_user = User.objects.create_user(
            username="modprof", email="modprof@example.com", password="pass12345"
        )
        self.prof = Professors.objects.create(user=prof_user, department=self.dept)
        self.subject = Subject.objects.create(code="MOD101", title="Modality")
        self.assignment = ProfessorSubject.objects.create(
            professor=self.prof, subject=self.subject
        )

    def test_patch_modality(self):
        url = (
            f"/api/departments/{self.dept.id}/professor-subjects/"
            f"{self.assignment.id}/"
        )
        response = self.client.patch(
            url, {"modality": "asynchronous"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["modality"], "asynchronous")
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.modality, "asynchronous")

    def test_patch_rejects_unknown_modality(self):
        url = (
            f"/api/departments/{self.dept.id}/professor-subjects/"
            f"{self.assignment.id}/"
        )
        response = self.client.patch(url, {"modality": "hybrid"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SubjectViewSetDepartmentFilterTests(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Dept A")
        other = Department.objects.create(name="Dept B")
        self.prof_a1 = self._make_professor("profa1", self.dept)
        prof_a2 = self._make_professor("profa2", self.dept)
        prof_b = self._make_professor("profb1", other)
        self.subject_a1 = Subject.objects.create(code="SA101", title="Subject A1")
        self.subject_a2 = Subject.objects.create(code="SA102", title="Subject A2")
        self.subject_b1 = Subject.objects.create(code="SB201", title="Subject B1")
        ProfessorSubject.objects.create(professor=self.prof_a1, subject=self.subject_a1)
        # Both dept-A professors qualify for SA102: the filter must deduplicate.
        ProfessorSubject.objects.create(professor=self.prof_a1, subject=self.subject_a2)
        ProfessorSubject.objects.create(professor=prof_a2, subject=self.subject_a2)
        ProfessorSubject.objects.create(professor=prof_b, subject=self.subject_b1)
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

    def _listed_codes(self, query=None):
        response = self.client.get(reverse("subject-list"), query or {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["code"] for row in response.data["results"]}

    def test_department_filter_returns_qualified_subjects(self):
        self.assertEqual(
            self._listed_codes({"department": self.dept.id}),
            {"SA101", "SA102"},
        )

    def test_department_filter_deduplicates_shared_qualifications(self):
        codes = self._listed_codes({"department": self.dept.id})
        self.assertEqual(sorted(codes), ["SA101", "SA102"])

    def test_unseeded_department_falls_back_to_all_subjects(self):
        # A department with zero ProfessorSubject rows must still get the full
        # subject list so its head can create the first assignment.
        empty = Department.objects.create(name="Empty Dept")
        self.assertEqual(
            self._listed_codes({"department": empty.id}),
            {"SA101", "SA102", "SB201"},
        )

    def test_no_param_returns_all_subjects(self):
        self.assertEqual(
            self._listed_codes(), {"SA101", "SA102", "SB201"}
        )

    def test_invalid_department_value_is_ignored(self):
        self.assertEqual(
            self._listed_codes({"department": "not-a-number"}),
            {"SA101", "SA102", "SB201"},
        )
