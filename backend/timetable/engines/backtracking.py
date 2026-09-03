"""CSP engine: backtracking with most-constrained-variable ordering + pruning.

Exhaustive where time allows, so it proves feasibility (or infeasibility) on
small instances and returns a best-effort partial otherwise. Rooms are assigned
first-fit within a time slot; the meeting is only placeable if a free,
large-enough room exists (a forward-check that prunes dead-end time slots).
"""

import time
from typing import Dict, List, Optional, Tuple

from .scenario import Meeting, Placement, Scenario
from .slots import free_rooms, is_time_free, legal_time_slots


def _candidates(
    scenario: Scenario,
    placed: Dict[int, Placement],
    meeting: Meeting,
) -> List[Tuple[int, int]]:
    result = []
    for day, start in legal_time_slots(scenario, meeting, placed):
        if is_time_free(scenario, placed, meeting, day, start) and free_rooms(
            scenario, placed, meeting, day, start
        ):
            result.append((day, start))
    return result


def backtracking(scenario: Scenario, time_limit_s: float = 30.0) -> Dict[int, Placement]:
    meetings = scenario.meetings
    start_time = time.monotonic()
    best_partial: Dict[int, Placement] = {}

    def timed_out() -> bool:
        return time.monotonic() - start_time >= time_limit_s

    def search(placed: Dict[int, Placement]) -> Optional[Dict[int, Placement]]:
        if timed_out():
            return None

        if len(placed) > len(best_partial):
            best_partial.update(placed)

        if len(placed) == len(meetings):
            return dict(placed)

        best: Optional[Tuple[int, Meeting, List[Tuple[int, int]]]] = None
        for meeting in meetings:
            if meeting.meeting_id in placed:
                continue
            candidates = _candidates(scenario, placed, meeting)
            count = len(candidates)
            if best is None or count < best[0]:
                best = (count, meeting, candidates)
            if count == 0:
                return None

        assert best is not None
        _, meeting, candidates = best
        for day, start in candidates:
            rooms = free_rooms(scenario, placed, meeting, day, start)
            rooms.sort(key=lambda r: r.capacity)
            placed[meeting.meeting_id] = Placement(
                meeting_id=meeting.meeting_id, day=day, start=start, room_id=rooms[0].id
            )
            solution = search(placed)
            if solution is not None:
                return solution
            del placed[meeting.meeting_id]

        return None

    solution = search({})
    return solution if solution is not None else best_partial
