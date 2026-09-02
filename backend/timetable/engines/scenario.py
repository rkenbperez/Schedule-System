"""Pure-Python scheduling data structures.

This module intentionally imports nothing from Django so the solver engines
can run standalone (and be tested without a database).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# Default opening hours, expressed as minutes since midnight.
# Monday-Friday 07:00-19:00, Saturday 07:00-13:00.
DEFAULT_DAY_RANGES: Dict[int, Tuple[int, int]] = {
    0: (7 * 60, 19 * 60),
    1: (7 * 60, 19 * 60),
    2: (7 * 60, 19 * 60),
    3: (7 * 60, 19 * 60),
    4: (7 * 60, 19 * 60),
    5: (7 * 60, 13 * 60),
}

SLOT_MINUTES = 60

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def minutes_to_clock(minutes: int) -> str:
    hour, minute = divmod(minutes, 60)
    return f"{hour:02d}:{minute:02d}"


@dataclass(frozen=True)
class RoomRef:
    id: int
    name: str
    capacity: int


@dataclass(frozen=True)
class Availability:
    prof_id: int
    day: int
    start: int
    end: int
    is_preferred: bool = False


@dataclass(frozen=True)
class Busy:
    prof_id: int
    day: int
    start: int
    end: int


@dataclass(frozen=True)
class Meeting:
    meeting_id: int
    assignment_id: int
    prof_id: int
    prof_label: str
    subject_label: str
    section_id: int
    section_name: str
    section_headcount: int
    duration_slots: int


@dataclass
class Scenario:
    rooms: List[RoomRef] = field(default_factory=list)
    meetings: List[Meeting] = field(default_factory=list)
    availability: List[Availability] = field(default_factory=list)
    busy: List[Busy] = field(default_factory=list)
    prof_daily_hours: Dict[int, int] = field(default_factory=dict)
    day_ranges: Dict[int, Tuple[int, int]] = field(
        default_factory=lambda: dict(DEFAULT_DAY_RANGES)
    )
    slot_minutes: int = SLOT_MINUTES

    def meeting_map(self) -> Dict[int, Meeting]:
        return {m.meeting_id: m for m in self.meetings}

    def room_map(self) -> Dict[int, RoomRef]:
        return {r.id: r for r in self.rooms}

    def max_daily_hours(self, prof_id: int) -> int:
        return self.prof_daily_hours.get(prof_id, 8)


@dataclass(frozen=True)
class Placement:
    meeting_id: int
    day: int
    start: int
    room_id: int


@dataclass
class PlacedClass:
    assignment_id: int
    meeting_id: int
    prof_id: int
    section_id: int
    day: int
    start: int
    duration_slots: int
    room_id: int


@dataclass
class RunResult:
    algorithm: str
    feasible: bool
    runtime_ms: float
    soft_score: Optional[float] = None
    classes: List[PlacedClass] = field(default_factory=list)
    violations: List[str] = field(default_factory=list)
    unplaced: List[int] = field(default_factory=list)
    breakdown: Dict[str, float] = field(default_factory=dict)
