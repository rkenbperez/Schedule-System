"""Runner: one entry point that runs any engine and normalizes the result."""

import time
from typing import Dict, List

from . import backtracking, greedy, min_conflicts
from .constraints import hard_violations
from .scenario import Placement, PlacedClass, RunResult, Scenario
from .scoring import soft_score

ALGORITHMS = {
    "greedy": greedy.greedy,
    "min_conflicts": min_conflicts.min_conflicts,
    "backtracking": backtracking.backtracking,
}


def run(
    algorithm: str,
    scenario: Scenario,
    time_limit_s: float = 30.0,
    seed: int = 0,
) -> RunResult:
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm}")

    engine = ALGORITHMS[algorithm]
    start = time.monotonic()

    if algorithm == "min_conflicts":
        placed = engine(scenario, time_limit_s=time_limit_s, seed=seed)
    else:
        placed = engine(scenario, time_limit_s=time_limit_s)

    runtime_ms = (time.monotonic() - start) * 1000.0

    violations = hard_violations(scenario, placed)
    feasible = not violations

    meeting_map = scenario.meeting_map()
    classes = [
        PlacedClass(
            assignment_id=meeting_map[p.meeting_id].assignment_id,
            meeting_id=p.meeting_id,
            prof_id=meeting_map[p.meeting_id].prof_id,
            section_id=meeting_map[p.meeting_id].section_id,
            day=p.day,
            start=p.start,
            duration_slots=meeting_map[p.meeting_id].duration_slots,
            room_id=p.room_id,
            mode=meeting_map[p.meeting_id].mode,
        )
        for p in placed.values()
    ]
    classes.sort(key=lambda c: (c.day, c.start))

    soft_score_value = None
    breakdown: Dict[str, float] = {}
    if feasible:
        soft_score_value, breakdown = soft_score(scenario, placed)

    unplaced = [m.meeting_id for m in scenario.meetings if m.meeting_id not in placed]

    return RunResult(
        algorithm=algorithm,
        feasible=feasible,
        runtime_ms=runtime_ms,
        soft_score=soft_score_value,
        classes=classes,
        violations=violations,
        unplaced=unplaced,
        breakdown=breakdown,
    )
