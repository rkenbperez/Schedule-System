## Summary

Phase 3 of long-term fix for unplaced meetings: Auto-assign improvements with weighted scoring & load balancing.

### Changes

**Backend:**
- Rewrote `auto_assign_professors` in `backend/timetable/services/auto_assign.py` with weighted scoring:
  - Preferred qualification: +50 pts
  - Same department match: +10 pts
  - Load balancing (lighter weekly load): +10 pts max
  - Availability bonus: +5 pts (placeholder)
  - Consecutive hours penalty: -20 pts (placeholder)
- Added load balancing across days using `ScheduledClass` day loads
- Fixed `_day_loads` to use `ScheduledClass` instead of `MeetingSlot`
- Fixed auto_assign to use `SectionSubject.term` instead of `requirement.term`

**Test Updates:**
- All 300 backend tests pass
- No test modifications needed (auto-assign logic is backward compatible)

### Verification
- ✅ 300 backend tests pass
- ✅ Frontend build passes (pre-existing vitest errors only)
- ✅ Frontend lint passes (8 pre-existing warnings only)

### Files Changed
- `backend/timetable/services/auto_assign.py` - Complete rewrite with weighted scoring
- `backend/timetable/views.py` - Feasibility pre-check integration (from Phase 2)
- `backend/timetable/services/feasibility.py` - Feasibility service (Phase 2)
- Tests updated for `force=true` parameter (Phase 2)

### Verification
- ✅ 300 backend tests pass
- ✅ Frontend build passes (pre-existing vitest errors only)
- ✅ Frontend lint passes (8 pre-existing warnings only)

### Next Phases
- **Phase 4**: Engine resilience (lab fallback, room sharing, meeting splitting)
- **Phase 5**: Import validation, capacity checks
- **Phase 6**: Feasibility dashboard & alerting

### Files Changed
- `backend/timetable/services/auto_assign.py` - Complete rewrite with weighted scoring
- `backend/timetable/views.py` - Feasibility pre-check integration (from Phase 2)
- `backend/timetable/services/feasibility.py` - Feasibility service (Phase 2)
- Tests updated for `force=true` parameter (Phase 2)