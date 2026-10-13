"""Scalability tests - Load testing for large schedules."""

import time
from datetime import date, time as dtime
from django.test import TestCase
from django.contrib.auth import get_user_model

from catalog.models import Department, Room, Section, Subject
from users.models import Professors
from timetable.models import (
    AcademicTerm, Assignment, AvailabilityWindow, MeetingSlot,
    ScheduleRun, ScheduledClass
)
from timetable.engines import run
from timetable.scenario_builder import build_scenario
from timetable.tests.factories import (
    AcademicTermFactory, DepartmentFactory, RoomFactory,
    SectionFactory, SubjectFactory, ProfessorFactory,
    ProfessorUserFactory, AssignmentFactory, MeetingSlotFactory,
    AvailabilityWindowFactory, RegistrarFactory
)

User = get_user_model()


class ScalabilityTests(TestCase):
    """Load tests for scheduling engine with large datasets."""

    def setUp(self):
        self.registrar = RegistrarFactory()
        # Create active term
        self.term = AcademicTermFactory(is_active=True)
        
        # Create base data
        self.departments = [DepartmentFactory() for _ in range(5)]
        self.subjects = [SubjectFactory() for _ in range(20)]
        self.rooms = []
        for dept in self.departments:
            self.rooms.extend([RoomFactory(department=dept) for _ in range(10)])
        
        self.professors = []
        for dept in self.departments:
            self.professors.extend([ProfessorFactory(department=dept) for _ in range(10)])
        
        # Create sections
        self.sections = []
        for i in range(100):
            self.sections.append(SectionFactory(
                term=self.term,
                program="BSIT" if i % 3 == 0 else ("BSCS" if i % 3 == 1 else "BSIS"),
                year_level=(i % 4) + 1
            ))

    def _create_assignments_for_sections(self, sections, meetings_per_section=2):
        """Create assignments for given sections."""
        assignments = []
        for i, section in enumerate(sections):
            prof = self.professors[i % len(self.professors)]
            subject = self.subjects[i % len(self.subjects)]
            assignment = AssignmentFactory(
                prof=prof,
                subject=subject,
                section=section,
                term=self.term
            )
            for order in range(1, meetings_per_section + 1):
                MeetingSlotFactory(
                    assignment=assignment,
                    order=order,
                    mode="sync",
                    duration_slots=2
                )
            assignments.append(assignment)
        return assignments

    def _create_availability_for_all_profs(self):
        """Create full availability for all professors."""
        for prof in self.professors:
            for day in range(5):  # Mon-Fri
                AvailabilityWindowFactory(
                    prof=prof,
                    day=day,
                    start_time=dtime(7, 0),
                    end_time=dtime(19, 0),
                    is_preferred=True
                )

    def test_100_sections_load(self):
        """Test scheduling 100 sections - baseline load."""
        assignments = self._create_assignments_for_sections(self.sections[:100])
        self._create_availability_for_all_profs()
        
        start = time.time()
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        elapsed = time.time() - start
        
        self.assertTrue(result.feasible, f"Failed: {result.violations}")
        self.assertLess(elapsed, 30, f"Too slow: {elapsed:.2f}s")
        print(f"\n100 sections: {elapsed:.2f}s, {len(result.classes)} classes placed")

    def test_200_sections_load(self):
        """Test scheduling 200 sections - medium load."""
        # Create more sections
        more_sections = [
            SectionFactory(
                term=self.term,
                program="BSIT" if i % 3 == 0 else ("BSCS" if i % 3 == 1 else "BSIS"),
                year_level=(i % 4) + 1
            ) for i in range(100, 200)
        ]
        all_sections = self.sections + more_sections
        
        assignments = self._create_assignments_for_sections(all_sections)
        self._create_availability_for_all_profs()
        
        start = time.time()
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        elapsed = time.time() - start
        
        self.assertTrue(result.feasible, f"Failed: {result.violations}")
        self.assertLess(elapsed, 30, f"Too slow: {elapsed:.2f}s")
        print(f"\n200 sections: {elapsed:.2f}s, {len(result.classes)} classes placed")

    def test_500_sections_load(self):
        """Test scheduling 500 sections - high load."""
        more_sections = [
            SectionFactory(
                term=self.term,
                program="BSIT" if i % 3 == 0 else ("BSCS" if i % 3 == 1 else "BSIS"),
                year_level=(i % 4) + 1
            ) for i in range(200, 500)
        ]
        all_sections = self.sections + more_sections
        
        # Add more professors
        for dept in self.departments:
            self.professors.extend([ProfessorFactory(department=dept) for _ in range(20)])
        
        assignments = self._create_assignments_for_sections(all_sections)
        self._create_availability_for_all_profs()
        
        start = time.time()
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=60)
        elapsed = time.time() - start
        
        self.assertTrue(result.feasible, f"Failed: {result.violations}")
        self.assertLess(elapsed, 60, f"Too slow: {elapsed:.2f}s")
        print(f"\n500 sections: {elapsed:.2f}s, {len(result.classes)} classes placed")

    def test_1000_sections_stress(self):
        """Stress test with 1000 sections - target from plan."""
        more_sections = [
            SectionFactory(
                term=self.term,
                program="BSIT" if i % 3 == 0 else ("BSCS" if i % 3 == 1 else "BSIS"),
                year_level=(i % 4) + 1
            ) for i in range(500, 1000)
        ]
        all_sections = self.sections + more_sections
        
        # Add many more professors
        for dept in self.departments:
            self.professors.extend([ProfessorFactory(department=dept) for _ in range(50)])
        
        # Add more rooms
        for dept in self.departments:
            self.rooms.extend([RoomFactory(department=dept) for _ in range(20)])
        
        assignments = self._create_assignments_for_sections(all_sections, meetings_per_section=3)
        self._create_availability_for_all_profs()
        
        start = time.time()
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=60)
        elapsed = time.time() - start
        
        # For 1000 sections, we allow infeasible but should complete in time
        self.assertLess(elapsed, 60, f"Too slow: {elapsed:.2f}s")
        print(f"\n1000 sections: {elapsed:.2f}s, feasible={result.feasible}, "
              f"placed={len(result.classes)}, unplaced={len(result.unplaced)}")

    def test_many_rooms_departments(self):
        """Test with many departments and rooms."""
        # Create 20 departments
        depts = [DepartmentFactory() for _ in range(20)]
        
        # 10 rooms per department
        for dept in depts:
            for _ in range(10):
                RoomFactory(department=dept)
        
        # 5 professors per department
        profs = []
        for dept in depts:
            profs.extend([ProfessorFactory(department=dept) for _ in range(5)])
        
        sections = [
            SectionFactory(term=self.term, program=f"PROG{i}", year_level=(i % 4) + 1)
            for i in range(100)
        ]
        
        for i, section in enumerate(sections):
            AssignmentFactory(
                prof=profs[i % len(profs)],
                subject=self.subjects[i % len(self.subjects)],
                section=section,
                term=self.term
            )
        
        for prof in profs:
            for day in range(5):
                AvailabilityWindowFactory(prof=prof, day=day)
        
        start = time.time()
        scenario = build_scenario(term=self.term)
        result = run("greedy", scenario, time_limit_s=30)
        elapsed = time.time() - start
        
        self.assertLess(elapsed, 30)
        print(f"\n20 depts, 200 rooms, 100 profs, 100 sections: {elapsed:.2f}s")


class EngineComparisonTests(TestCase):
    """Compare different algorithms on same scenarios."""

    def setUp(self):
        self.registrar = RegistrarFactory()
        self.term = AcademicTermFactory(is_active=True)
        self.dept = DepartmentFactory()
        
        self.rooms = [RoomFactory(department=self.dept) for _ in range(10)]
        self.professors = [ProfessorFactory(department=self.dept) for _ in range(10)]
        self.subjects = [SubjectFactory() for _ in range(10)]
        self.sections = [SectionFactory(term=self.term) for _ in range(50)]
        
        for i, section in enumerate(self.sections):
            AssignmentFactory(
                prof=self.professors[i % 10],
                subject=self.subjects[i % 10],
                section=section,
                term=self.term
            )
        
        for prof in self.professors:
            for day in range(5):
                AvailabilityWindowFactory(prof=prof, day=day)

    def test_algorithm_comparison(self):
        """Run all algorithms and compare results."""
        from timetable.engines import ALGORITHMS
        
        results = {}
        for algo_name in ALGORITHMS:
            if algo_name in ["greedy", "backtracking", "min_conflicts"]:
                scenario = build_scenario(term=self.term)
                start = time.time()
                result = run(algo_name, scenario, time_limit_s=30)
                elapsed = time.time() - start
                
                results[algo_name] = {
                    "feasible": result.feasible,
                    "placed": len(result.classes),
                    "unplaced": len(result.unplaced),
                    "time": elapsed,
                    "score": result.soft_score,
                }
                print(f"\n{algo_name}: feasible={result.feasible}, "
                      f"placed={len(result.classes)}, time={elapsed:.2f}s, "
                      f"score={result.soft_score}")
        
        # At least greedy should work
        self.assertTrue(results["greedy"]["feasible"])