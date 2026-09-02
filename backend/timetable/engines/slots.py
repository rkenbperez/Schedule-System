"""Shared slot-generation helpers used by every engine."""

from collections import defaultdict
from typing import Dict, List, Tuple

from .scenario import Meeting, Placement, RoomRef, Scenario


def minutes(scenario: Scenario, slots: int) -> int:
    return slots * scenario.slot_minutes


def overlaps(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
    return start_a < end_b and start_b < end_a


def _windows_by_prof_day(scenario: Scenario) -> Dict[Tuple[int, int], List[Tuple[int, int, bool]]]:
    grouped = defaultdict(list)
    for avail in scenario.availability:
        grouped[(avail.prof_id, avail.day)].append(
            (avail.start, avail.end, avail.is_preferred)
        )
    return grouped


def _busy_by_prof_day(scenario: Scenario) -> Dict[Tuple[int, int], List[Tuple[int, int]]]:
    grouped = defaultdict(list)
    for block in scenario.busy:
        grouped[(block.prof_id, block.day)].append((block.start, block.end))
    return grouped


def covered_by(window: Tuple[int, int, bool], start: int, end: int) -> bool:
    window_start, window_end, _ = window
    return window_start <= start and end <= window_end


def _daily_used(scenario: Scenario, placed: Dict[int, Placement]) -> Dict[Tuple[int, int], int]:
    used = defaultdict(int)
    meeting_map = scenario.meeting_map()
    for placement in placed.values():
        meeting = meeting_map[placement.meeting_id]
        used[(meeting.prof_id, placement.day)] += meeting.duration_slots
    return used


def legal_time_slots(
    scenario: Scenario, meeting: Meeting, placed: Dict[int, Placement]
) -> List[Tuple[int, int]]:
    """Return every (day, start_minute) where this meeting fits the time rules.

    Only checks availability, busy blocks, opening hours and the prof's daily
    cap. It deliberately ignores prof/section/room overlap, which the engines
    handle separately so each algorithm can make its own conflict decisions.
    """
    windows = _windows_by_prof_day(scenario)
    busy = _busy_by_prof_day(scenario)
    used = _daily_used(scenario, placed)
    duration = minutes(scenario, meeting.duration_slots)
    max_hours = scenario.max_daily_hours(meeting.prof_id)

    results = []
    for day, (day_start, day_end) in scenario.day_ranges.items():
        if used[(meeting.prof_id, day)] + meeting.duration_slots > max_hours:
            continue

        start = day_start
        while start + duration <= day_end:
            prof_windows = windows.get((meeting.prof_id, day), [])
            if not any(covered_by(w, start, start + duration) for w in prof_windows):
                start += scenario.slot_minutes
                continue

            prof_busy = busy.get((meeting.prof_id, day), [])
            if any(overlaps(start, start + duration, b_start, b_end) for b_start, b_end in prof_busy):
                start += scenario.slot_minutes
                continue

            results.append((day, start))
            start += scenario.slot_minutes

    return results


def legal_rooms(scenario: Scenario, meeting: Meeting) -> List[RoomRef]:
    return [r for r in scenario.rooms if r.capacity >= meeting.section_headcount]


def is_time_free(
    scenario: Scenario,
    placed: Dict[int, Placement],
    meeting: Meeting,
    day: int,
    start: int,
) -> bool:
    duration = minutes(scenario, meeting.duration_slots)
    meeting_map = scenario.meeting_map()
    for placement in placed.values():
        if placement.day != day:
            continue
        other = meeting_map[placement.meeting_id]
        other_duration = minutes(scenario, other.duration_slots)
        if not overlaps(
            start, start + duration, placement.start, placement.start + other_duration
        ):
            continue
        if other.prof_id == meeting.prof_id or other.section_id == meeting.section_id:
            return False
    return True


def free_rooms(
    scenario: Scenario,
    placed: Dict[int, Placement],
    meeting: Meeting,
    day: int,
    start: int,
) -> List[RoomRef]:
    duration = minutes(scenario, meeting.duration_slots)
    meeting_map = scenario.meeting_map()
    busy_room_ids = set()
    for placement in placed.values():
        if placement.day != day:
            continue
        other = meeting_map[placement.meeting_id]
        other_duration = minutes(scenario, other.duration_slots)
        if overlaps(
            start, start + duration, placement.start, placement.start + other_duration
        ):
            busy_room_ids.add(placement.room_id)

    return [
        r
        for r in scenario.rooms
        if r.capacity >= meeting.section_headcount and r.id not in busy_room_ids
    ]
