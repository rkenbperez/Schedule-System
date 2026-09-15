"""Single shared soft-scorer so all engines are compared fairly.

Lower score is better. The three components map to the thesis requirements:
- spread: punish a prof whose weekly load clumps into few days (the
  "dispersed Monday-Saturday" rule), measured as variance of per-day hours.
- consecutive: punish long unbroken teaching stretches (adjacent hour pairs).
- preferred: punish meetings placed outside an is_preferred availability window.
"""

from collections import defaultdict
from typing import Dict, Tuple

from .scenario import Placement, Scenario
from .slots import _windows_by_prof_day, hours, minutes

W_SPREAD = 10.0
W_CONSECUTIVE = 2.0
W_PREFERRED = 5.0


def soft_score(scenario: Scenario, placed: Dict[int, Placement]) -> Tuple[float, Dict[str, float]]:
    meeting_map = scenario.meeting_map()

    per_prof_hours = defaultdict(lambda: [0] * 6)
    occupied_hours = defaultdict(set)
    for placement in placed.values():
        meeting = meeting_map[placement.meeting_id]
        per_prof_hours[meeting.prof_id][placement.day] += hours(scenario, meeting.duration_slots)
        first_hour = placement.start // scenario.slot_minutes
        for slot in range(meeting.duration_slots):
            occupied_hours[(meeting.prof_id, placement.day)].add(first_hour + slot)

    spread = 0.0
    for day_hours in per_prof_hours.values():
        mean = sum(day_hours) / len(day_hours)
        spread += sum((h - mean) ** 2 for h in day_hours) / len(day_hours)

    consecutive = 0.0
    for occupied in occupied_hours.values():
        ordered = sorted(occupied)
        consecutive += sum(
            1 for a, b in zip(ordered, ordered[1:]) if b == a + 1
        )

    windows = _windows_by_prof_day(scenario)
    preferred = 0.0
    for placement in placed.values():
        meeting = meeting_map[placement.meeting_id]
        duration = minutes(scenario, meeting.duration_slots)
        prof_windows = windows.get((meeting.prof_id, placement.day), [])
        in_preferred = any(
            w_start <= placement.start and placement.start + duration <= w_end and is_preferred
            for w_start, w_end, is_preferred in prof_windows
        )
        if not in_preferred:
            preferred += 1.0

    breakdown = {
        "spread": spread,
        "consecutive": consecutive,
        "preferred": preferred,
    }
    total = (
        W_SPREAD * spread
        + W_CONSECUTIVE * consecutive
        + W_PREFERRED * preferred
    )
    breakdown["total"] = total
    return total, breakdown
