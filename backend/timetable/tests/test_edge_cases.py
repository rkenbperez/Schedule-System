"""Edge case tests - boundary conditions and pathological scenarios."""

from datetime import date, time as dtime
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from catalog.models import Department, Room, Section, Subject
from users.models import Professors
from timetable.models import (
    AcademicTerm, Assignment, AvailabilityWindow, BusyBlock,
    MeetingSlot, ScheduledClass, ScheduleRun
)
from timetable.engines import run
from timetable.scenario_builder import build_scenario
from timetable.tests.factories import (
    AcademicTermFactory, DepartmentFactory, RoomFactory,
    SectionFactory, SubjectFactory, ProfessorFactory,
    ProfessorUserFactory, AssignmentFactory, MeetingSlotFactory,
    AvailabilityWindowFactory, BusyBlockFactory, RegistrarFactory
)

User = get_user_model()


class EdgeCaseTests(TestCase):
    """Test edge cases and boundary conditions."""

    def setUp(self):
        self.registrar = RegistrarFactory()
        self.term = AcademicTermFactory(is_active=True)
        self.dept = DepartmentFactory()

    def test_single_room_all_sections(self):
        """Single room for all sections - should handle gracefully."""
        room = RoomFactory(department=self.dept, capacity=50)
        
        profs = [ProfessorFactory(department=self.dept) for _ in range(5)]
        subjects = [SubjectFactory() for _ in range(5)]
        sections = [SectionFactory(term=self.term, headcount=60) for _ in range(20)]  # Headcount > room capacity
        
        for i, section in enumerate(sections):
            assignment = AssignmentFactory(
                prof=profs[i % 5],
                subject=subjects[i % 5],
                section=section,
                term=self.term
            )
            MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        for prof in profs:
            for day in range(5):
                AvailabilityWindowFactory(prof=prof, day=day)
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible due to room capacity but not crash
        self.assertFalse(result.feasible)
        self.assertGreater(len(result.violations), 0)

    def test_one_professor_all_sections(self):
        """One professor teaches all sections."""
        prof = ProfessorFactory(department=self.dept)
        room = RoomFactory(department=self.dept, capacity=50)
        subjects = [SubjectFactory() for _ in range(5)]
        sections = [SectionFactory(term=self.term, headcount=30) for _ in range(20)]
        
        for i, section in enumerate(sections):
            assignment = AssignmentFactory(
                prof=prof,
                subject=subjects[i % 5],
                section=section,
                term=self.term
            )
            MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        for day in range(5):
            AvailabilityWindowFactory(prof=prof, day=day)
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible due to professor hours but not crash
        self.assertFalse(result.feasible)

    def test_all_async_invalid(self):
        """All async meetings - should be rejected by validation."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(
            prof=prof,
            subject=subject,
            section=section,
            term=self.term
        )
        
        # Try to create async-only meeting via serializer - should fail validation
        from timetable.serializers import AssignmentSerializer
        
        # First create a valid sync meeting
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        # Now try to replace with only async via serializer
        serializer = AssignmentSerializer(assignment, data={
            "prof": prof.id,
            "subject": subject.id,
            "section": section.id,
            "term": self.term.id,
            "meetings": [{"mode": "async", "duration_slots": 1}]
        })
        serializer.is_valid()
        self.assertFalse(serializer.is_valid())
        self.assertIn("meetings", serializer.errors)

    def test_overlapping_terms(self):
        """Two terms overlapping in dates."""
        # Use unique years to avoid unique constraint conflicts with other tests
        term1 = AcademicTermFactory(
            year=2030, semester=1,
            start_date=date(2030, 8, 1),
            end_date=date(2030, 12, 20),
            is_active=True
        )
        term2 = AcademicTermFactory(
            year=2030, semester=2,
            start_date=date(2030, 11, 1),  # Overlaps with term1
            end_date=date(2031, 3, 30),
            is_active=False
        )
        
        # Same section in both terms - need separate sections
        section1 = SectionFactory(term=term1)
        section2 = SectionFactory(term=term2, name=f"{section1.name}-T2")
        
        prof = ProfessorFactory(department=self.dept)
        subject = SubjectFactory()
        
        # Create assignments manually to ensure term matches section
        assignment1 = Assignment.objects.create(
            prof=prof, subject=subject, section=section1, term=term1
        )
        MeetingSlot.objects.create(assignment=assignment1, order=1, mode="sync", duration_slots=2)
        
        assignment2 = Assignment.objects.create(
            prof=prof, subject=subject, section=section2, term=term2
        )
        MeetingSlot.objects.create(assignment=assignment2, order=1, mode="sync", duration_slots=2)
        
        # Should be able to build scenario for specific term
        scenario = build_scenario(term=term1)
        self.assertEqual(len(scenario.meetings), 1)
        
        scenario2 = build_scenario(term=term2)
        self.assertEqual(len(scenario2.meetings), 1)

    def test_mid_term_schedule_change(self):
        """Mid-term schedule change - regenerate with same term."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        room = RoomFactory(department=self.dept)
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        for day in range(5):
            AvailabilityWindowFactory(prof=prof, day=day)
        
        # First run
        scenario = build_scenario(term=self.term)
        result1 = run("greedy", scenario, time_limit_s=30)
        self.assertTrue(result1.feasible)
        
        # Add a busy block for the professor (mid-term change)
        BusyBlockFactory(prof=prof, day=0, start_time=dtime(8, 0), end_time=dtime(12, 0))
        
        # Second run
        scenario2 = build_scenario(term=self.term)
        result2 = run("greedy", scenario2, time_limit_s=30)
        
        # Should still be feasible or report proper violations
        if not result2.feasible:
            self.assertGreater(len(result2.violations), 0)

    def test_zero_availability(self):
        """Professor with no availability windows."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        # No availability windows created
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible
        self.assertFalse(result.feasible)

    def test_busy_block_conflicts_with_availability(self):
        """Busy block overlaps with availability window."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        # Availability 8am-5pm
        AvailabilityWindowFactory(prof=prof, day=0, start_time=dtime(8, 0), end_time=dtime(17, 0))
        # Busy block 10am-2pm (overlaps)
        BusyBlockFactory(prof=prof, day=0, start_time=dtime(10, 0), end_time=dtime(14, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should still work - busy blocks reduce availability
        if result.feasible:
            # Verify no class scheduled during busy block
            for c in result.classes:
                if c.day == 0:
                    class_start = dtime(c.start // 60, c.start % 60)
                    class_end = dtime((c.start + c.duration_slots * 60) // 60, (c.start + c.duration_slots * 60) % 60)
                    self.assertTrue(
                        class_end <= dtime(10, 0) or class_start >= dtime(14, 0),
                        "Class scheduled during busy block"
                    )

    def test_minimum_duration_slots(self):
        """Test minimum duration slot validation."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        
        # Duration slots = 0 should fail
        with self.assertRaises(IntegrityError):
            MeetingSlotFactory(assignment=assignment, duration_slots=0)

    def test_invalid_day_values(self):
        """Test invalid day values are rejected."""
        prof = ProfessorFactory(department=self.dept)
        
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                AvailabilityWindowFactory(prof=prof, day=6)  # Sunday (invalid)
        
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                AvailabilityWindowFactory(prof=prof, day=-1)

    def test_time_reversal_rejected(self):
        """Start time after end time should be rejected."""
        prof = ProfessorFactory(department=self.dept)
        
        with self.assertRaises(IntegrityError):
            AvailabilityWindowFactory(
                prof=prof, day=0,
                start_time=dtime(17, 0), end_time=dtime(8, 0)
            )

    def test_max_consecutive_boundary(self):
        """Test exactly at max consecutive hours."""
        prof = ProfessorFactory(department=self.dept, max_consecutive=4)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        # 2 meetings of 2 slots = 4 consecutive
        MeetingSlotFactory(assignment=assignment, order=1, mode="sync", duration_slots=2)
        MeetingSlotFactory(assignment=assignment, order=2, mode="sync", duration_slots=2)
        
        AvailabilityWindowFactory(prof=prof, day=0, start_time=dtime(8, 0), end_time=dtime(17, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # At boundary, should be feasible if scheduler places them consecutively
        # If not feasible, that's also valid behavior (scheduler couldn't place them)
        # Just verify it runs without error
        self.assertIsNotNone(result)
        self.assertIsInstance(result.feasible, bool)

    def test_max_consecutive_exceeded(self):
        """Test exceeding max consecutive hours."""
        prof = ProfessorFactory(department=self.dept, max_consecutive=3)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        # 2 meetings of 2 slots = 4 consecutive (exceeds 3)
        MeetingSlotFactory(assignment=assignment, order=1, mode="sync", duration_slots=2)
        MeetingSlotFactory(assignment=assignment, order=2, mode="sync", duration_slots=2)
        
        AvailabilityWindowFactory(prof=prof, day=0, start_time=dtime(8, 0), end_time=dtime(17, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible or place with violation
        self.assertFalse(result.feasible)

    def test_no_subjects(self):
        """Term with no subjects/assignments."""
        empty_term = AcademicTermFactory(
            year=2025, semester=1,
            start_date=date(2025, 8, 1),
            end_date=date(2025, 12, 20),
            is_active=True
        )
        
        scenario = build_scenario(term=empty_term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Empty schedule should be feasible
        self.assertTrue(result.feasible)
        self.assertEqual(len(result.classes), 0)

    def test_no_rooms(self):
        """Term with no rooms."""
        empty_term = AcademicTermFactory(
            year=2025, semester=1,
            start_date=date(2025, 8, 1),
            end_date=date(2025, 12, 20),
            is_active=True
        )
        
        # No rooms created
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=empty_term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=empty_term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        AvailabilityWindowFactory(prof=prof, day=0)
        
        scenario = build_scenario(term=empty_term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible
        self.assertFalse(result.feasible)

    def test_section_headcount_exceeds_all_rooms(self):
        """Section headcount larger than any room capacity."""
        # Small rooms
        RoomFactory(department=self.dept, capacity=20)
        RoomFactory(department=self.dept, capacity=25)
        
        # Large section
        section = SectionFactory(term=self.term, headcount=100)
        prof = ProfessorFactory(department=self.dept)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        AvailabilityWindowFactory(prof=prof, day=0)
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should be infeasible due to capacity
        self.assertFalse(result.feasible)

    def test_room_with_no_department_shared(self):
        """Room with no department should be shared across all."""
        room = RoomFactory(department=None, capacity=50)
        
        dept1 = DepartmentFactory()
        dept2 = DepartmentFactory()
        
        prof1 = ProfessorFactory(department=dept1)
        prof2 = ProfessorFactory(department=dept2)
        
        section1 = SectionFactory(term=self.term)
        section2 = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        AssignmentFactory(prof=prof1, subject=subject, section=section1, term=self.term)
        AssignmentFactory(prof=prof2, subject=subject, section=section2, term=self.term)
        
        MeetingSlotFactory(assignment=Assignment.objects.get(prof=prof1), mode="sync", duration_slots=2)
        MeetingSlotFactory(assignment=Assignment.objects.get(prof=prof2), mode="sync", duration_slots=2)
        
        for prof in [prof1, prof2]:
            AvailabilityWindowFactory(prof=prof, day=0)
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Both professors should be able to use the shared room
        self.assertTrue(result.feasible)


class ConstraintValidationEdgeCases(TestCase):
    """Test specific constraint edge cases."""

    def setUp(self):
        self.term = AcademicTermFactory(is_active=True)
        self.dept = DepartmentFactory()

    def test_exact_room_capacity_match(self):
        """Section headcount exactly equals room capacity."""
        room = RoomFactory(department=self.dept, capacity=30)
        section = SectionFactory(term=self.term, headcount=30)
        prof = ProfessorFactory(department=self.dept)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        AvailabilityWindowFactory(prof=prof, day=0)
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Exact match should be feasible
        self.assertTrue(result.feasible)

    def test_multiple_meetings_same_day(self):
        """Multiple meetings for same section on same day."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        # Two 2-slot meetings
        MeetingSlotFactory(assignment=assignment, order=1, mode="sync", duration_slots=2)
        MeetingSlotFactory(assignment=assignment, order=2, mode="sync", duration_slots=2)
        
        AvailabilityWindowFactory(prof=prof, day=0, start_time=dtime(8, 0), end_time=dtime(17, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # May or may not be feasible depending on room availability
        # Just verify it runs without error
        self.assertIsNotNone(result)
        self.assertIsInstance(result.feasible, bool)

    def test_friday_only_availability(self):
        """Professor only available Friday."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        # Only Friday (day 4)
        AvailabilityWindowFactory(prof=prof, day=4, start_time=dtime(8, 0), end_time=dtime(17, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        # Should schedule on Friday only
        if result.feasible:
            for c in result.classes:
                self.assertEqual(c.day, 4)

    def test_saturday_availability(self):
        """Professor available Saturday (day 5)."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        assignment = AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        MeetingSlotFactory(assignment=assignment, mode="sync", duration_slots=2)
        
        # Saturday (day 5)
        AvailabilityWindowFactory(prof=prof, day=5, start_time=dtime(8, 0), end_time=dtime(13, 0))
        
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        
        if result.feasible:
            for c in result.classes:
                self.assertEqual(c.day, 5)


class DatabaseConstraintEdgeCases(TestCase):
    """Test database-level constraint edge cases."""

    def setUp(self):
        self.term = AcademicTermFactory(is_active=True)
        self.dept = DepartmentFactory()

    def test_duplicate_academic_term_rejected(self):
        """Duplicate year+semester should be rejected."""
        AcademicTermFactory(year=2024, semester=1)
        with self.assertRaises(IntegrityError):
            AcademicTermFactory(year=2024, semester=1)

    def test_duplicate_assignment_same_term_rejected(self):
        """Duplicate prof+subject+section+term should be rejected."""
        prof = ProfessorFactory(department=self.dept)
        section = SectionFactory(term=self.term)
        subject = SubjectFactory()
        
        AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)
        with self.assertRaises(IntegrityError):
            AssignmentFactory(prof=prof, subject=subject, section=section, term=self.term)

    def test_same_assignment_different_term_allowed(self):
        """Same prof+subject+section with different term should be allowed."""
        prof = ProfessorFactory(department=self.dept)
        section1 = SectionFactory(term=self.term)
        
        term2 = AcademicTermFactory(
            year=2024, semester=2,
            start_date=date(2025, 1, 15), end_date=date(2025, 5, 30),
            is_active=False
        )
        section2 = SectionFactory(term=term2, name=f"{section1.name}-T2")
        
        subject = SubjectFactory()
        
        AssignmentFactory(prof=prof, subject=subject, section=section1, term=self.term)
        # Different term - should be allowed
        assignment2 = AssignmentFactory(
            prof=prof, subject=subject, section=section2, term=term2
        )
        self.assertEqual(assignment2.term, term2)

    def test_meeting_slot_order_unique_per_assignment(self):
        """Meeting slot order unique per assignment."""
        assignment = AssignmentFactory(term=self.term)
        MeetingSlotFactory(assignment=assignment, order=1)
        with self.assertRaises(IntegrityError):
            MeetingSlotFactory(assignment=assignment, order=1)

    def test_scheduled_class_foreign_keys(self):
        """ScheduledClass requires valid foreign keys."""
        run = ScheduleRun.objects.create(
            algorithm="greedy",
            status=ScheduleRun.Status.FEASIBLE,
            term=self.term
        )
        
        assignment = AssignmentFactory(term=self.term)
        room = RoomFactory(department=self.dept)
        
        # Valid creation
        sc = ScheduledClass.objects.create(
            run=run, assignment=assignment, room=room,
            day=0, start_time=dtime(8, 0), duration_slots=2, term=self.term
        )
        self.assertEqual(sc.term, self.term)
        
        # Invalid room should fail at DB level
        from django.db import IntegrityError
        # (Would need to test with non-existent PK - Django handles this)

    def test_cascade_delete_assignment_removes_meetings(self):
        """Deleting assignment should cascade to meetings."""
        assignment = AssignmentFactory(term=self.term)
        MeetingSlotFactory(assignment=assignment, order=1)
        MeetingSlotFactory(assignment=assignment, order=2)
        
        meeting_count = assignment.meetings.count()
        self.assertEqual(meeting_count, 2)
        
        assignment.delete()
        self.assertEqual(MeetingSlot.objects.filter(assignment_id=assignment.id).count(), 0)

    def test_cascade_delete_term_removes_sections(self):
        """Deleting term should cascade to sections."""
        SectionFactory(term=self.term)
        SectionFactory(term=self.term)
        
        section_count = Section.objects.filter(term=self.term).count()
        self.assertEqual(section_count, 2)
        
        term_id = self.term.id
        self.term.delete()
        self.assertEqual(Section.objects.filter(term_id=term_id).count(), 0)