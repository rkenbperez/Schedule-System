from datetime import time

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import SimpleTestCase, TestCase

from catalog.models import Room, Section, Subject
from users.models import Professors

from timetable.models import (
    Assignment,
    AvailabilityWindow,
    BusyBlock,
    MeetingSlot,
    ScheduledClass,
    ScheduleRun,
)


class AssignmentTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="prof1", password="pass12345")
        self.prof = Professors.objects.create(user=user)
        self.subject = Subject.objects.create(code="CC101", title="Intro")
        self.section = Section.objects.create(name="BSIT-3A", headcount=40)

    def _assignment(self):
        return Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
        )

    def test_duplicate_assignment_rejected(self):
        self._assignment()
        with self.assertRaises(IntegrityError):
            self._assignment()

    def test_valid_assignment_accepted(self):
        assignment = self._assignment()
        self.assertEqual(assignment.meetings.count(), 0)

    def test_duplicate_meeting_order_rejected(self):
        assignment = self._assignment()
        MeetingSlot.objects.create(
            assignment=assignment, order=1, mode="sync", duration_slots=1
        )
        with self.assertRaises(IntegrityError):
            MeetingSlot.objects.create(
                assignment=assignment, order=1, mode="sync", duration_slots=1
            )

    def test_zero_duration_slots_rejected(self):
        assignment = self._assignment()
        with self.assertRaises(IntegrityError):
            MeetingSlot.objects.create(
                assignment=assignment, order=1, mode="sync", duration_slots=0
            )

    def test_invalid_mode_rejected(self):
        assignment = self._assignment()
        slot = MeetingSlot(
            assignment=assignment, order=1, mode="webinar", duration_slots=1
        )
        with self.assertRaises(ValidationError):
            slot.full_clean()

    def test_default_mode_is_sync(self):
        assignment = self._assignment()
        slot = MeetingSlot.objects.create(
            assignment=assignment, order=1, duration_slots=2
        )
        self.assertEqual(slot.mode, "sync")
        self.assertEqual(slot.get_mode_display(), "Synchronous")
        self.assertEqual(assignment.meetings.count(), 1)


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

    def test_end_time_computed_from_duration(self):
        klass = ScheduledClass.objects.create(
            run=self.run,
            assignment=self.assignment,
            room=self.room,
            day=0,
            start_time=time(8, 0),
            duration_slots=2,
        )
        self.assertEqual(klass.end_time, time(10, 0))

    def test_end_time_wraps_no_rollover(self):
        klass = ScheduledClass.objects.create(
            run=self.run,
            assignment=self.assignment,
            room=self.room,
            day=0,
            start_time=time(23, 0),
            duration_slots=1,
        )
        self.assertEqual(klass.end_time, time(0, 0))

    def test_end_time_single_slot(self):
        klass = ScheduledClass(
            start_time=time(7, 30),
            duration_slots=1,
        )
        self.assertEqual(klass.end_time, time(8, 30))
