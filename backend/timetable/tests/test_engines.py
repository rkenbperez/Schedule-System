from django.test import SimpleTestCase

from timetable.engines import run
from timetable.engines.scenario import (
    Availability,
    Meeting,
    Placement,
    RoomRef,
    Scenario,
)
from timetable.engines.scoring import soft_score


def _meeting(mid, prof_id, duration=1, section_id=1, headcount=20, subject="CC101"):
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
    )


def _room(rid, capacity=30):
    return RoomRef(id=rid, name=f"R{rid}", capacity=capacity)


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
