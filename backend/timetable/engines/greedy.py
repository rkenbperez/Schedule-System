"""Greedy engine: sort hardest-first, place each meeting in its first legal slot.

Never backtracks, so it is fast but can leave a meeting unplaced even when a
solution exists (the classic limitation the CSP engine overcomes).
"""

import time
from typing import Dict

from .scenario import Placement, Scenario
from .slots import free_rooms, is_time_free, legal_time_slots


def greedy(scenario: Scenario, time_limit_s: float = 30.0) -> Dict[int, Placement]:
    deadline = time.monotonic() + time_limit_s

    if time.monotonic() >= deadline:
        return {}

    initial_counts: Dict[int, int] = {}
    for meeting in scenario.meetings:
        if time.monotonic() >= deadline:
            break
        initial_counts[meeting.meeting_id] = len(
            legal_time_slots(scenario, meeting, {})
        )

    fallback = len(scenario.meetings) + 1
    ordered = sorted(
        scenario.meetings,
        key=lambda m: (initial_counts.get(m.meeting_id, fallback), -m.duration_slots),
    )

    placed: Dict[int, Placement] = {}
    for meeting in ordered:
        if time.monotonic() >= deadline:
            break

        for day, start in legal_time_slots(scenario, meeting, placed):
            if not is_time_free(scenario, placed, meeting, day, start):
                continue
            rooms = free_rooms(scenario, placed, meeting, day, start)
            if not rooms:
                continue
            rooms.sort(key=lambda r: r.capacity)
            placed[meeting.meeting_id] = Placement(
                meeting_id=meeting.meeting_id,
                day=day,
                start=start,
                room_id=rooms[0].id,
            )
            break

    return placed
