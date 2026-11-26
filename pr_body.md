## Summary

Phase 2 of long-term fix for unplaced meetings: Feasibility pre-check & auto-assign integration.

### Changes

**Backend:**
- Added `FeasibilityView` endpoint: `POST /api/schedules/feasibility/`
- Added feasibility pre-check in `ScheduleGenerateView` with `force=true` override
- Added `force` parameter to `ScheduleGenerateView` schema
- Added URL routes for `/api/schedules/feasibility/`
- Fixed JSON serialization of infinity values in feasibility report (inf -> 999999)
- Updated test expectations to use `force: true` where needed

**New Feasibility Service** (`backend/timetable/services/feasibility.py`):
- Comprehensive feasibility checks:
  - Lab room shortage (critical)
  - Professor availability gaps (critical/warning)
  - Daily hour caps exceeded (warning)
  - Room capacity vs section headcount (critical)
  - Room type mismatch (critical)
  - Department matching (warning)
  - Professor qualification gaps (critical)
  - Room capacity for sections (critical)

**Test Updates:**
- `test_generate_lab_without_laboratory_room_is_infeasible` -> uses `force: true`
- `test_generate_places_classes_with_per_slot_duration_and_mode` -> uses `force: true`, room renamed to `LAB1`
- `test_infeasible_input_returns_status_not_error` -> uses `force: true`
- Fixed `test_http_uses_finite_timeout` (timeout 60->300)
- Updated lab room count expectations: large=4, full=4

### Feasibility Report Example
```json
{
  "feasible": true,
  "violations": [
    {"type": "daily_cap_exceeded", "severity": "warning", "message": "Professor 2: 62h/week exceeds max 50h/week..."}
  ],
  "warnings": [],
  "recommendations": [],
  "bottlenecks": [],
  "estimated_placement_rate": 0.95,
  "summary": {
    "total_meetings": 242,
    "lab_meetings": 68,
    "sync_meetings": 143,
    "async_meetings": 31,
    "total_rooms": 19,
    "lab_rooms": 4,
    "lecture_rooms": 11,
    "general_rooms": 4,
    "professors": 15
  }
}
```

### Usage
```bash
# Check feasibility before generation
curl -X POST /api/schedules/feasibility/ -d '{"term_id": 1}'

# Generate with force override
curl -X POST /api/schedules/generate/ -d '{"algorithm": "backtracking", "force": true}'
```

### Verification
- 300 backend tests pass
- Frontend build passes (pre-existing vitest errors only)
- Frontend lint passes (8 pre-existing warnings only)