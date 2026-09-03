"""Scheduling engines.

Pure Python (no Django imports) so the algorithms run standalone. The single
Django-touching adapter lives in ``timetable.scenario_builder``.
"""

from .runner import ALGORITHMS, run
from .scenario import (
    Availability,
    Busy,
    Meeting,
    PlacedClass,
    Placement,
    RoomRef,
    RunResult,
    Scenario,
)

__all__ = [
    "ALGORITHMS",
    "run",
    "Availability",
    "Busy",
    "Meeting",
    "PlacedClass",
    "Placement",
    "RoomRef",
    "RunResult",
    "Scenario",
]
