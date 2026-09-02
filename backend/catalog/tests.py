from django.test import TestCase

from .models import Room, Section, Subject


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
