from datetime import time

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from catalog.models import Room, Section, Subject
from users.models import Professors

from .models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    ScheduledClass,
    ScheduleRun,
)


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

    def test_zero_meetings_per_week_rejected(self):
        with self.assertRaises(IntegrityError):
            Assignment.objects.create(
                prof=self.prof,
                subject=self.subject,
                section=self.section,
                meetings_per_week=0,
            )

    def test_zero_duration_slots_rejected(self):
        with self.assertRaises(IntegrityError):
            Assignment.objects.create(
                prof=self.prof,
                subject=self.subject,
                section=self.section,
                duration_slots=0,
            )

    def test_valid_assignment_accepted(self):
        assignment = Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
            meetings_per_week=2,
            duration_slots=3,
        )
        self.assertEqual(assignment.meetings_per_week, 2)


class TimeRangeTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="prof2", password="pass12345")
        self.prof = Professors.objects.create(user=user)

    def test_availability_reversed_time_rejected(self):
        with self.assertRaises(IntegrityError):
            AvailabilityWindow.objects.create(
                prof=self.prof,
                day=0,
                start_time=time(13, 0),
                end_time=time(8, 0),
            )

    def test_availability_equal_time_rejected(self):
        with self.assertRaises(IntegrityError):
            AvailabilityWindow.objects.create(
                prof=self.prof,
                day=0,
                start_time=time(8, 0),
                end_time=time(8, 0),
            )

    def test_availability_out_of_range_day_rejected(self):
        with self.assertRaises(IntegrityError):
            AvailabilityWindow.objects.create(
                prof=self.prof,
                day=6,
                start_time=time(8, 0),
                end_time=time(12, 0),
            )

    def test_availability_valid_accepted(self):
        window = AvailabilityWindow.objects.create(
            prof=self.prof,
            day=0,
            start_time=time(8, 0),
            end_time=time(12, 0),
        )
        self.assertEqual(window.get_day_display(), "Monday")

    def test_busyblock_reversed_time_rejected(self):
        with self.assertRaises(IntegrityError):
            BusyBlock.objects.create(
                prof=self.prof,
                day=0,
                start_time=time(13, 0),
                end_time=time(8, 0),
            )

    def test_busyblock_out_of_range_day_rejected(self):
        with self.assertRaises(IntegrityError):
            BusyBlock.objects.create(
                prof=self.prof,
                day=-1,
                start_time=time(8, 0),
                end_time=time(9, 0),
            )

    def test_busyblock_valid_accepted(self):
        block = BusyBlock.objects.create(
            prof=self.prof,
            day=5,
            start_time=time(8, 0),
            end_time=time(9, 0),
        )
        self.assertEqual(block.get_day_display(), "Saturday")


class ScheduledClassTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="prof3", password="pass12345")
        self.prof = Professors.objects.create(user=user)
        self.subject = Subject.objects.create(code="CC102", title="Math")
        self.section = Section.objects.create(name="BSIT-3B", headcount=35)
        self.room = Room.objects.create(name="R201", capacity=50)
        self.assignment = Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
        )
        self.run = ScheduleRun.objects.create(
            algorithm="greedy",
            status=ScheduleRun.Status.FEASIBLE,
        )

    def test_zero_duration_slots_rejected(self):
        with self.assertRaises(IntegrityError):
            ScheduledClass.objects.create(
                run=self.run,
                assignment=self.assignment,
                room=self.room,
                day=0,
                start_time=time(8, 0),
                duration_slots=0,
            )

    def test_valid_class_accepted(self):
        klass = ScheduledClass.objects.create(
            run=self.run,
            assignment=self.assignment,
            room=self.room,
            day=0,
            start_time=time(8, 0),
            duration_slots=1,
        )
        self.assertEqual(klass.get_day_display(), "Monday")

    def test_out_of_range_day_rejected(self):
        with self.assertRaises(IntegrityError):
            ScheduledClass.objects.create(
                run=self.run,
                assignment=self.assignment,
                room=self.room,
                day=7,
                start_time=time(8, 0),
                duration_slots=1,
            )
