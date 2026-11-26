from django.contrib.auth.models import User
from django.test import TestCase
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
