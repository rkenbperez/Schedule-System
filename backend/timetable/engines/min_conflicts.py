"""Min-conflicts engine: local search over a fully-assigned schedule.

Starts by placing every meeting (allowing collisions), then repeatedly moves a
random conflicted meeting to the slot that minimizes remaining conflicts.
Seeded for determinism in tests.
"""

import random
import time
from typing import Dict

from .constraints import count_conflicts, hard_violations
from .scenario import Meeting, Placement, Scenario
from .slots import legal_rooms, legal_time_slots


def _initial_assignment(scenario: Scenario, rng: random.Random) -> Dict[int, Placement]:
    placed: Dict[int, Placement] = {}
    for meeting in scenario.meetings:
        slots = legal_time_slots(scenario, meeting, placed)
        rooms = legal_rooms(scenario, meeting)
        if not slots or not rooms:
            continue
        day, start = rng.choice(slots)
        room_id = rng.choice(rooms).id
        placed[meeting.meeting_id] = Placement(
            meeting_id=meeting.meeting_id, day=day, start=start, room_id=room_id
        )
    return placed


def _conflicted_meetings(scenario: Scenario, placed: Dict[int, Placement]) -> list:
    meeting_map = scenario.meeting_map()
    conflicted = set()
    for meeting_id in placed:
        meeting = meeting_map[meeting_id]
        placement = placed[meeting_id]
        remaining = {k: v for k, v in placed.items() if k != meeting_id}
        if count_conflicts(scenario, remaining, meeting, placement.day, placement.start, placement.room_id) > 0:
            conflicted.add(meeting_id)
    return list(conflicted)


def min_conflicts(
    scenario: Scenario,
    time_limit_s: float = 30.0,
    max_iterations: int = 20000,
    seed: int = 0,
) -> Dict[int, Placement]:
    rng = random.Random(seed)
    deadline = time.monotonic() + time_limit_s
    meeting_map = scenario.meeting_map()

    placed = _initial_assignment(scenario, rng)
    if not placed:
        return placed

    for _ in range(max_iterations):
        if time.monotonic() >= deadline:
            break

        conflicted = _conflicted_meetings(scenario, placed)
        if not conflicted:
            break

        meeting_id = rng.choice(conflicted)
        meeting = meeting_map[meeting_id]
        remaining = {k: v for k, v in placed.items() if k != meeting_id}

        best_conflicts = None
        best_candidates = []
        for day, start in legal_time_slots(scenario, meeting, remaining):
            for room in legal_rooms(scenario, meeting):
                conflicts = count_conflicts(
                    scenario, remaining, meeting, day, start, room.id
                )
                if best_conflicts is None or conflicts < best_conflicts:
                    best_conflicts = conflicts
                    best_candidates = [(day, start, room.id)]
                elif conflicts == best_conflicts:
                    best_candidates.append((day, start, room.id))

        if best_candidates:
            day, start, room_id = rng.choice(best_candidates)
            placed[meeting_id] = Placement(
                meeting_id=meeting_id, day=day, start=start, room_id=room_id
            )

    return placed
