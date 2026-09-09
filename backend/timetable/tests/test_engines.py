from django.test import SimpleTestCase

from timetable.engines import run
from timetable.engines.constraints import hard_violations
from timetable.engines.scenario import (
    Availability,
    Meeting,
    Placement,
    RoomRef,
    Scenario,
)
from timetable.engines.scoring import soft_score
from timetable.engines.slots import _daily_used


def _meeting(mid, prof_id, duration=1, section_id=1, headcount=20, subject="CC101", department=""):
    return Meeting(
        meeting_id=mid,
        assignment_id=mid,
        prof_id=prof_id,
        prof_label=f"Prof{prof_id}",
        subject_label=subject,
        section_id=section_id,
        section_name=f"SEC{section_id}",
        section_headcount=headcount,
        duration_slots=duration,
        department=department,
    )


def _room(rid, capacity=30, department=""):
    return RoomRef(id=rid, name=f"R{rid}", capacity=capacity, department=department)


def _loose_scenario():
    rooms = [_room(1, 40), _room(2, 40)]
    meetings = [
        _meeting(1, prof_id=1, section_id=1),
        _meeting(2, prof_id=1, section_id=2),
        _meeting(3, prof_id=2, section_id=1),
        _meeting(4, prof_id=2, section_id=2),
    ]
    availability = []
    for prof_id in (1, 2):
        for day in range(5):
            availability.append(
                Availability(prof_id=prof_id, day=day, start=8 * 60, end=17 * 60)
            )
    return Scenario(rooms=rooms, meetings=meetings, availability=availability)


def _trap_scenario():
    """List-coloring trap: greedy fails, backtracking succeeds.

    Three meetings share one section (so they all collide), but each prof has
    different availability. Greedy fills the earliest slots and strands the
    third meeting; CSP revisits and finds the spread-out solution.
    """
    rooms = [_room(1, 30)]
    meetings = [
        _meeting(1, prof_id=1, section_id=1),
        _meeting(2, prof_id=2, section_id=1),
        _meeting(3, prof_id=3, section_id=1),
    ]
    availability = [
        Availability(prof_id=1, day=0, start=8 * 60, end=9 * 60),
        Availability(prof_id=1, day=0, start=10 * 60, end=11 * 60),
        Availability(prof_id=2, day=0, start=8 * 60, end=10 * 60),
        Availability(prof_id=3, day=0, start=8 * 60, end=10 * 60),
    ]
    return Scenario(rooms=rooms, meetings=meetings, availability=availability)


class GreedyEngineTests(SimpleTestCase):
    def test_greedy_places_everything_on_loose_scenario(self):
        scenario = _loose_scenario()
        result = run("greedy", scenario)
        self.assertTrue(result.feasible, result.violations)
        self.assertEqual(len(result.classes), 4)
        self.assertFalse(result.violations)

    def test_greedy_misses_trap_solution(self):
        scenario = _trap_scenario()
        result = run("greedy", scenario)
        self.assertFalse(result.feasible)
        self.assertTrue(result.unplaced)


class BacktrackingEngineTests(SimpleTestCase):
    def test_backtracking_solves_loose_scenario(self):
        scenario = _loose_scenario()
        result = run("backtracking", scenario)
        self.assertTrue(result.feasible, result.violations)

    def test_backtracking_solves_trap_greedy_misses(self):
        scenario = _trap_scenario()
        result = run("backtracking", scenario)
        self.assertTrue(result.feasible, result.violations)
        self.assertEqual(len(result.classes), 3)


class MinConflictsEngineTests(SimpleTestCase):
    def test_min_conflicts_reaches_feasible_on_loose_scenario(self):
        scenario = _loose_scenario()
        result = run("min_conflicts", scenario, seed=0)
        self.assertTrue(result.feasible, result.violations)


class ConstraintValidationTests(SimpleTestCase):
    def test_slot_minutes_zero_rejected(self):
        with self.assertRaises(ValueError):
            Scenario(slot_minutes=0)

    def test_out_of_hours_placement_detected(self):
        scenario = Scenario(
            rooms=[_room(1, 30)],
            meetings=[_meeting(1, prof_id=1)],
            availability=[Availability(prof_id=1, day=0, start=8 * 60, end=17 * 60)],
        )
        placed = {1: Placement(meeting_id=1, day=0, start=20 * 60, room_id=1)}
        violations = hard_violations(scenario, placed)
        self.assertTrue(any("opening hours" in v for v in violations))

    def test_misaligned_start_detected(self):
        scenario = Scenario(
            rooms=[_room(1, 30)],
            meetings=[_meeting(1, prof_id=1)],
            availability=[Availability(prof_id=1, day=0, start=8 * 60, end=17 * 60)],
        )
        placed = {1: Placement(meeting_id=1, day=0, start=8 * 60 + 30, room_id=1)}
        violations = hard_violations(scenario, placed)
        self.assertTrue(any("not aligned" in v for v in violations))

    def test_unknown_day_does_not_crash(self):
        scenario = Scenario(
            rooms=[_room(1, 30)],
            meetings=[_meeting(1, prof_id=1)],
            availability=[Availability(prof_id=1, day=0, start=8 * 60, end=17 * 60)],
        )
        placed = {1: Placement(meeting_id=1, day=6, start=8 * 60, room_id=1)}
        violations = hard_violations(scenario, placed)
        self.assertTrue(any("unknown day" in v for v in violations))

    def test_daily_used_is_integer_minutes(self):
        scenario = Scenario(
            slot_minutes=10,
            rooms=[_room(1, 30)],
            meetings=[_meeting(1, prof_id=1, duration=6)],
            availability=[Availability(prof_id=1, day=0, start=0, end=24 * 60)],
        )
        placed = {1: Placement(meeting_id=1, day=0, start=0, room_id=1)}
        used = _daily_used(scenario, placed)
        self.assertEqual(used[(1, 0)], 60)
        self.assertIsInstance(used[(1, 0)], int)


class InfeasibilityTests(SimpleTestCase):
    def test_no_availability_reports_unplaced(self):
        scenario = Scenario(
            rooms=[_room(1, 30)],
            meetings=[_meeting(1, prof_id=1)],
            availability=[],
        )
        result = run("greedy", scenario)
        self.assertFalse(result.feasible)
        self.assertTrue(result.unplaced)
        self.assertTrue(any("not placed" in v for v in result.violations))


class ScoringTests(SimpleTestCase):
    def _spread_scenario(self):
        rooms = [_room(1, 30)]
        meetings = [
            _meeting(1, prof_id=1, section_id=1),
            _meeting(2, prof_id=1, section_id=1),
            _meeting(3, prof_id=1, section_id=1),
            _meeting(4, prof_id=1, section_id=1),
        ]
        availability = [
            Availability(prof_id=1, day=day, start=8 * 60, end=17 * 60)
            for day in range(5)
        ]
        return Scenario(rooms=rooms, meetings=meetings, availability=availability)

    def test_spread_schedule_scores_better_than_clumped(self):
        scenario = self._spread_scenario()

        clumped = {
            1: Placement(meeting_id=1, day=0, start=8 * 60, room_id=1),
            2: Placement(meeting_id=2, day=0, start=9 * 60, room_id=1),
            3: Placement(meeting_id=3, day=0, start=10 * 60, room_id=1),
            4: Placement(meeting_id=4, day=0, start=11 * 60, room_id=1),
        }
        spread = {
            1: Placement(meeting_id=1, day=0, start=8 * 60, room_id=1),
            2: Placement(meeting_id=2, day=1, start=8 * 60, room_id=1),
            3: Placement(meeting_id=3, day=2, start=8 * 60, room_id=1),
            4: Placement(meeting_id=4, day=3, start=8 * 60, room_id=1),
        }

        clumped_score, _ = soft_score(scenario, clumped)
        spread_score, _ = soft_score(scenario, spread)
        self.assertLess(spread_score, clumped_score)


def _department_scenario(meeting_department, room_department):
    rooms = [_room(1, 40, department=room_department)]
    meetings = [_meeting(1, prof_id=1, department=meeting_department)]
    availability = [
        Availability(prof_id=1, day=day, start=8 * 60, end=17 * 60) for day in range(5)
    ]
    return Scenario(rooms=rooms, meetings=meetings, availability=availability)


class DepartmentSolverTests(SimpleTestCase):
    def test_prof_teaches_in_matching_department_room(self):
        result = run("greedy", _department_scenario("CS", "CS"))
        self.assertTrue(result.feasible, result.violations)
        self.assertEqual(len(result.classes), 1)

    def test_prof_rejected_from_other_department_room(self):
        result = run("greedy", _department_scenario("CS", "IT"))
        self.assertFalse(result.feasible)
        self.assertTrue(result.unplaced)

    def test_mismatched_placement_reported_as_violation(self):
        scenario = _department_scenario("CS", "IT")
        placed = {1: Placement(meeting_id=1, day=0, start=8 * 60, room_id=1)}
        violations = hard_violations(scenario, placed)
        self.assertTrue(any("is for IT" in v for v in violations), violations)

    def test_department_and_capacity_violations_reported_together(self):
        rooms = [_room(1, 40, department="IT")]
        meetings = [
            _meeting(1, prof_id=1, headcount=60, department="CS")
        ]
        scenario = Scenario(
            rooms=rooms,
            meetings=meetings,
            availability=[
                Availability(prof_id=1, day=day, start=8 * 60, end=17 * 60)
                for day in range(5)
            ],
        )
        placed = {1: Placement(meeting_id=1, day=0, start=8 * 60, room_id=1)}
        violations = hard_violations(scenario, placed)
        self.assertTrue(any("is for IT" in v for v in violations), violations)
        self.assertTrue(any("too small" in v for v in violations), violations)

    def test_blank_room_is_shared_across_departments(self):
        result = run("greedy", _department_scenario("CS", ""))
        self.assertTrue(result.feasible, result.violations)

    def test_prof_without_department_uses_any_room(self):
        result = run("greedy", _department_scenario("", "CS"))
        self.assertTrue(result.feasible, result.violations)

    def test_department_match_is_case_insensitive(self):
        result = run("greedy", _department_scenario("cs", "CS"))
        self.assertTrue(result.feasible, result.violations)
