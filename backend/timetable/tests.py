from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from catalog.models import Section, Subject
from users.models import Professors

from .models import Assignment


class AssignmentTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="prof1", password="pass12345")
        self.prof = Professors.objects.create(user=user)
        self.subject = Subject.objects.create(code="CC101", title="Intro")
        self.section = Section.objects.create(name="BSIT-3A", headcount=40)

    def test_duplicate_assignment_rejected(self):
        Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
        )
        with self.assertRaises(IntegrityError):
            Assignment.objects.create(
                prof=self.prof,
                subject=self.subject,
                section=self.section,
            )
