from datetime import time

from django.contrib.auth.models import User
from django.test import TestCase

from catalog.models import Department, Room, Section, Subject
from timetable.engines import run
from timetable.scenario_builder import build_scenario
from users.models import Professors


class ScenarioBuilderTests(TestCase):
    def setUp(self):
        self.prof = Professors.objects.create(
            user=User.objects.create_user(username="prof1", password="pass12345")
        )
        self.subject = Subject.objects.create(code="CC101", title="Intro")
        self.section = Section.objects.create(name="BSIT-3A", headcount=30)
        Room.objects.create(name="R201", capacity=40)

    def test_build_and_solve_feasible_scenario(self):
        from timetable.models import Assignment, AvailabilityWindow

        Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
            meetings_per_week=2,
            duration_slots=1,
        )
        for day in range(5):
            AvailabilityWindow.objects.create(
                prof=self.prof,
                day=day,
                start_time=time(8, 0),
                end_time=time(17, 0),
            )

        scenario = build_scenario()
        self.assertEqual(len(scenario.meetings), 2)
        self.assertEqual(scenario.meetings[0].section_headcount, 30)

        result = run("greedy", scenario)
        self.assertTrue(result.feasible, result.violations)
        self.assertEqual(len(result.classes), 2)

    def test_departments_carried_into_scenario(self):
        from timetable.models import Assignment, AvailabilityWindow

        dept = Department.objects.create(name="CS")
        self.prof.department = dept
        self.prof.save(update_fields=["department"])
        Room.objects.create(name="R202", capacity=40, department=dept)
        Assignment.objects.create(
            prof=self.prof,
            subject=self.subject,
            section=self.section,
            meetings_per_week=1,
            duration_slots=1,
        )
        AvailabilityWindow.objects.create(
            prof=self.prof, day=0, start_time=time(8, 0), end_time=time(17, 0)
        )

        scenario = build_scenario()
        self.assertEqual(scenario.meetings[0].department, "CS")
        cs_rooms = [r for r in scenario.rooms if r.name == "R202"]
        self.assertEqual(cs_rooms[0].department, "CS")
