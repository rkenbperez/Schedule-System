"""Hard-constraint validation shared by all engines."""

from collections import defaultdict
from typing import Dict, List

from .scenario import Meeting, Placement, Scenario, minutes_to_clock
from .slots import (
    _busy_by_prof_day,
    _daily_used,
    _windows_by_prof_day,
    covered_by,
    minutes,
    overlaps,
)


def hard_violations(scenario: Scenario, placed: Dict[int, Placement]) -> List[str]:
    """Return a human-readable list of every hard-rule violation."""
    meeting_map = scenario.meeting_map()
    room_map = scenario.room_map()
    violations: List[str] = []

    unplaced = [m for m in scenario.meetings if m.meeting_id not in placed]
    if unplaced:
        labels = ", ".join(_label(meeting_map, m.meeting_id) for m in unplaced)
        violations.append(f"{len(unplaced)} meeting(s) not placed: {labels}")

    by_day = defaultdict(list)
    for placement in placed.values():
        by_day[placement.day].append(placement)

    for day, placements in by_day.items():
        for i in range(len(placements)):
            for j in range(i + 1, len(placements)):
                a = placements[i]
                b = placements[j]
                meeting_a = meeting_map[a.meeting_id]
                meeting_b = meeting_map[b.meeting_id]
                duration_a = minutes(scenario, meeting_a.duration_slots)
                duration_b = minutes(scenario, meeting_b.duration_slots)
                if not overlaps(
                    a.start, a.start + duration_a, b.start, b.start + duration_b
                ):
                    continue

                if meeting_a.prof_id == meeting_b.prof_id:
                    violations.append(
                        f"{meeting_a.prof_label} double-booked on {_day(day)}"
                    )
                if meeting_a.section_id == meeting_b.section_id:
                    violations.append(
                        f"section {meeting_a.section_name} double-booked on {_day(day)}"
                    )
                if a.room_id == b.room_id:
                    violations.append(f"room {a.room_id} double-booked on {_day(day)}")

    windows = _windows_by_prof_day(scenario)
    busy = _busy_by_prof_day(scenario)
    used = _daily_used(scenario, placed)
    max_hours = {
        prof_id: scenario.max_daily_hours(prof_id)
        for prof_id in {meeting_map[p.meeting_id].prof_id for p in placed.values()}
    }

    for placement in placed.values():
        meeting = meeting_map[placement.meeting_id]
        duration = minutes(scenario, meeting.duration_slots)

        day_range = scenario.day_ranges.get(placement.day)
        if day_range is None:
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} on unknown day {placement.day}"
            )
            continue
        day_start, day_end = day_range
        if placement.start % scenario.slot_minutes != 0:
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} start "
                f"{minutes_to_clock(placement.start)} not aligned to "
                f"{scenario.slot_minutes}-minute grid"
            )
        if placement.start < day_start or placement.start + duration > day_end:
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} outside opening hours "
                f"on {_day(placement.day)}"
            )

        room = room_map.get(placement.room_id)
        if room is None:
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} has no assigned room"
            )
        elif room.capacity < meeting.section_headcount:
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} room {room.name} "
                f"(cap {room.capacity}) too small for section {meeting.section_name} "
                f"(headcount {meeting.section_headcount})"
            )

        prof_windows = windows.get((meeting.prof_id, placement.day), [])
        if not any(
            covered_by(w, placement.start, placement.start + duration) for w in prof_windows
        ):
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} outside "
                f"{meeting.prof_label}'s availability on {_day(placement.day)}"
            )

        prof_busy = busy.get((meeting.prof_id, placement.day), [])
        if any(
            overlaps(placement.start, placement.start + duration, b_start, b_end)
            for b_start, b_end in prof_busy
        ):
            violations.append(
                f"{_label(meeting_map, meeting.meeting_id)} inside "
                f"{meeting.prof_label}'s busy block on {_day(placement.day)}"
            )

        if used[(meeting.prof_id, placement.day)] > max_hours[meeting.prof_id]:
            violations.append(
                f"{meeting.prof_label} exceeds daily limit "
                f"({used[(meeting.prof_id, placement.day)]:g}h > {max_hours[meeting.prof_id]}h) "
                f"on {_day(placement.day)}"
            )

    return violations


def is_feasible(scenario: Scenario, placed: Dict[int, Placement]) -> bool:
    return not hard_violations(scenario, placed)


def count_conflicts(
    scenario: Scenario,
    placed: Dict[int, Placement],
    meeting: Meeting,
    day: int,
    start: int,
    room_id: int,
) -> int:
    """Count how many already-placed meetings this candidate collides with."""
    meeting_map = scenario.meeting_map()
    duration = minutes(scenario, meeting.duration_slots)
    conflicts = 0
    for placement in placed.values():
        if placement.meeting_id == meeting.meeting_id:
            continue
        if placement.day != day:
            continue
        other = meeting_map[placement.meeting_id]
        other_duration = minutes(scenario, other.duration_slots)
        if not overlaps(
            start, start + duration, placement.start, placement.start + other_duration
        ):
            continue
        if (
            other.prof_id == meeting.prof_id
            or other.section_id == meeting.section_id
            or placement.room_id == room_id
        ):
            conflicts += 1
    return conflicts


def _label(meeting_map: Dict[int, Meeting], meeting_id: int) -> str:
    meeting = meeting_map[meeting_id]
    return f"{meeting.subject_label}/{meeting.section_name}"


def _day(day: int) -> str:
    from .scenario import DAY_NAMES

    return DAY_NAMES[day]
