## Summary
Phase 4 of the long-term fix for unplaced meetings. Implements engine resilience features:

### Changes

#### 1. Lab Fallback to General Rooms
- **Feasibility check** (`services/feasibility.py`): Now counts general rooms as lab fallback capacity (`effective_lab_rooms = lab_rooms + general_rooms`)
- **Room type matching** (`engines/slots.py`): `room_type_ok()` allows lab meetings in general rooms; new `room_type_fallback()` tracks when fallback occurs
- **Room prioritization**: `legal_rooms()` and `free_rooms()` return exact matches first, then fallback rooms
- **Soft violation** (`engines/constraints.py`): Lab-in-general fallback reported as warning (not hard violation)

#### 2. Async Meetings Don't Need Physical Rooms
- **All 3 engines** (`greedy.py`, `min_conflicts.py`, `backtracking.py`): Skip room assignment for async meetings
- **Slots**: `legal_rooms()` and `free_rooms()` return `[]` for async
- **Constraints**: Skip room double-booking, capacity, type checks for async
- **Data structures** (`scenario.py`): `Placement.room_id` and `PlacedClass.room_id` now `Optional[int] = None`
- **Demo output**: Shows "room Online" for async meetings

#### 3. Soft Violations / Warnings System
- **New `soft_violations()`** function in `constraints.py`
- **`RunResult`** includes `warnings: List[str]` field
- **Runner** collects warnings and includes in result
- **API response** (`views.py`) returns `warnings` field
- **Currently tracks**: Lab-in-general fallback warnings

#### 4. Demo Data with Real Names
- **`management/commands/demo_schedule.py`**: 22 real professor names across 4 departments (CS, IT, MATH, GE) instead of `demo_prof1`, `demo_prof2`, etc.

### Test Results
- All 31 engine tests pass
- All 47 API tests pass  
- All 33 scenario/edge case tests pass
- Normal scale (53 meetings): All 3 algorithms feasible
- Large scale (79 meetings): All 3 algorithms feasible

### Files Modified
- 13 files changed, 485 insertions(+), 244 deletions(-)