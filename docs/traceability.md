# Traceability

This matrix links each requirement to its primary use case, implementation, and
automated test evidence. It is a navigation and audit aid, not proof of complete
coverage. Where no dedicated test exists, the gap is stated explicitly.

Status labels follow the [documentation conventions](README.md): **Implemented**,
**Legacy**, **Planned**, and **Known gap**.

## Functional requirements

| Requirement | Use case | Primary implementation | Primary test evidence |
| --- | --- | --- | --- |
| FR-AUTH-01 | UC-01 | `users/views.py` `JWTLoginView`; `users/urls.py` | `timetable.tests.test_jwt_auth` |
| FR-AUTH-02 | UC-01 | `JWTRefreshView`, `JWTVerifyView` | `timetable.tests.test_jwt_auth` |
| FR-AUTH-03 | UC-01 | `JWTLogoutView`; token blacklist app | `timetable.tests.test_jwt_auth` |
| FR-AUTH-04 | UC-01 | `JWTMeView` | `timetable.tests.test_jwt_auth` |
| FR-AUTH-05 | UC-01 | Legacy routes in `users/urls.py` | `timetable.tests.test_jwt_auth` |
| FR-AUTH-06 | UC-03–UC-21 | `core/permissions.py` `IsRegistrar` | `timetable.tests.test_rbac` |
| FR-AUTH-07 | UC-09, UC-10, UC-14 | `IsProfessor`, professor viewsets | `timetable.tests.test_rbac`, `test_api` |
| FR-AUTH-08 | UC-15 | `IsPublicReadOnly`, public schedule views | `timetable.tests.test_rbac`, `test_api` |
| FR-TERM-01 | UC-02 | `AcademicTerm` model | `timetable.tests.test_models`, `test_edge_cases` |
| FR-TERM-02 | UC-02 | `AcademicTerm` unique constraint | `timetable.tests.test_models` |
| FR-TERM-03 | UC-02 | `AcademicTerm.code` / `name` properties | `timetable.tests.test_models` |
| FR-TERM-04 | UC-11, UC-16 | `ScheduleGenerateView`, `scenario_builder`, analytics filters | `timetable.tests.test_scenario_builder`, `test_analytics` |
| FR-TERM-05 | UC-02 | Django admin only; **Known gap** for API CRUD | No API test; admin is exercised manually |
| FR-CAT-01 | UC-03–UC-06 | `catalog/views.py` viewsets | `timetable.tests.test_api` |
| FR-CAT-02 | UC-03–UC-06 | Unique constraints and serializers | `timetable.tests.test_models`, `test_api` |
| FR-CAT-03 | UC-06 | `Section` model | `timetable.tests.test_models` |
| FR-CAT-04 | UC-04 | `Room` model | `timetable.tests.test_models` |
| FR-PROF-01 | UC-07 | `users/models.py` `Professors` | `timetable.tests.test_models` |
| FR-PROF-02 | UC-07 | `Professors.department`, limits | `timetable.tests.test_models` |
| FR-PROF-03 | UC-09, UC-10 | `ProfessorAvailabilityViewSet`, `ProfessorBusyBlockViewSet` | `timetable.tests.test_rbac`, `test_api` |
| FR-PROF-04 | UC-07 | `ProfessorsViewSet` | `timetable.tests.test_api` |
| FR-ASG-01 | UC-08 | `Assignment` model | `timetable.tests.test_models` |
| FR-ASG-02 | UC-08 | `Assignment` unique constraint | `timetable.tests.test_models` |
| FR-ASG-03 | UC-08 | `AssignmentSerializer` meeting validation | `timetable.tests.test_api` |
| FR-ASG-04 | UC-08 | `MeetingSlot.Mode` choices | `timetable.tests.test_models` |
| FR-ASG-05 | UC-08 | `MeetingSlot.duration_slots` check constraint | `timetable.tests.test_models` |
| FR-ASG-06 | UC-08 | `get_mode_duration`, serializer fallback | `timetable.tests.test_api` (`GlobalSettingsApiTests`) |
| FR-ASG-07 | UC-08 | Explicit `duration_slots` validation | `timetable.tests.test_api` |
| FR-ASG-08 | UC-08 | Serializer `validate()` sync/lab rule | `timetable.tests.test_api` |
| FR-ASG-09 | UC-19 | `GlobalSettings.set`; migration seeds | `timetable.tests.test_api`; manual settings check |
| FR-ASG-10 | UC-08 | `BulkCreateAssignmentsView` | `timetable.tests.test_api` (bulk path; verify when changing) |
| FR-SCH-01 | UC-11 | `ScheduleGenerateView` | `timetable.tests.test_api`, `test_engines` |
| FR-SCH-02 | UC-11 | `engines/runner.py` `ALGORITHMS` | `timetable.tests.test_engines` |
| FR-SCH-03 | UC-11 | `engines/constraints.py`, `slots.py` | `timetable.tests.test_engines`, `test_scalability` |
| FR-SCH-04 | UC-11 | `runner.run`, `hard_violations` | `timetable.tests.test_engines` |
| FR-SCH-05 | UC-11, UC-12 | `ScheduleGenerateView` transaction | `timetable.tests.test_api` |
| FR-SCH-06 | UC-11 | `ScheduleRun` model and serializer | `timetable.tests.test_api`, `test_analytics` |
| FR-SCH-07 | UC-12 | Run list/detail/classes views | `timetable.tests.test_api` |
| FR-SCH-08 | UC-12 | `analytics/conflicts.py`, conflict view | `timetable.tests.test_analytics` |
| FR-SCH-09 | UC-13, UC-15 | Publish view, public views | `timetable.tests.test_api`, `test_rbac` |
| FR-SCH-10 | UC-14 | `ProfessorScheduleView` | `timetable.tests.test_api`, `test_rbac` |
| FR-SCH-11 | UC-16 | `timetable/analytics/` | `timetable.tests.test_analytics` |
| FR-DATA-01 | UC-17 | `ImportPreviewView`; import processor | `data_transfer.tests.test_import` |
| FR-DATA-02 | UC-17 | Preview token and cache | `data_transfer.tests.test_import` |
| FR-DATA-03 | UC-17 | XLSX/CSV template views | `data_transfer.tests.test_import` |
| FR-DATA-04 | UC-18 | `export_utils.py`, export views | `data_transfer.tests.test_export`; **known failures** |
| FR-DATA-05 | UC-20 | `AuditLogListView` | No dedicated automated test; read-only surface |
| FR-DATA-06 | UC-20 | **Known gap**; no automatic writes | Not applicable |
| FR-DATA-07 | UC-19 | `GlobalSettingsView`, detail view | `timetable.tests.test_api` (`GlobalSettingsApiTests`) |
| FR-DATA-08 | UC-19 | `validate_setting_value`, helpers | `timetable.tests.test_api` |
| FR-DATA-09 | UC-21 | Conflict-resolution list/resolve/ignore views | No dedicated automated test |
| FR-DATA-10 | UC-21 | **Known gap**; no automatic creation | Not applicable |

## Non-functional requirements

| Requirement | Primary evidence | Current state |
| --- | --- | --- |
| NFR-01 | JWT/RBAC implementation; security review | Partial: hardcoded `SECRET_KEY`, `DEBUG=True` |
| NFR-02 | SimpleJWT rotate/blacklist; logout view | Implemented |
| NFR-03 | `users/throttles.py` | **Known gap:** throttle class is not attached |
| NFR-04 | Demo runs; runtime fields | Demonstrated at demo scale; request-blocking for larger inputs |
| NFR-05 | `test_scalability` | Partial: 100/200-section cases currently fail |
| NFR-06 | `ScheduleGenerateView` persistence | Implemented |
| NFR-07 | `transaction.atomic()` generation | Implemented |
| NFR-08 | `engines/` has no Django imports | Implemented |
| NFR-09 | Test suite | See [Testing](testing.md) for the current result and known failures |
| NFR-10 | Requirements and setup docs | Python 3.14 + SQLite development; PostgreSQL planned for production |
| NFR-11 | drf-spectacular routes, `docs/api/openapi.yaml` | Implemented |
| NFR-12 | `AuditLog` model and read API | Partial: no automatic writes |
| NFR-13 | DRF error/pagination behavior | Implemented, with custom analytics envelope |
| NFR-14 | Legacy token/statistics routes | Implemented and labeled legacy |

## Business rules

| Rule | Enforcement | Evidence |
| --- | --- | --- |
| BR-01 | Application logic: generation uses active term | `scenario_builder.py`, `ScheduleGenerateView`; `test_api` |
| BR-02 | Engine department-room rule | `slots.department_ok`; `test_engines` |
| BR-03 | Serializer sync/lab rule | `AssignmentSerializer`; `test_api` |
| BR-04 | Model check and serializer | `MeetingSlot`; `test_models` |
| BR-05 | Model check constraints | `AvailabilityWindow`, `BusyBlock`; `test_models` |
| BR-06 | Engine and conflict auditor | `constraints.py`, `analytics/conflicts.py`; `test_engines`, `test_analytics` |
| BR-07 | Engine and conflict auditor | capacity checks; `test_engines`, `test_analytics` |
| BR-08 | Engine and conflict auditor | daily/consecutive checks; `test_engines`, `test_analytics` |
| BR-09 | Permissions and queryset filters | public/published views; `test_rbac` |
| BR-10 | `IsRegistrarOrReadOnly`, `IsRegistrar` | `core/permissions.py`; `test_rbac` |
| BR-11 | `IsProfessor`, ownership filters | professor viewsets; `test_rbac` |
| BR-12 | Database unique constraints | models; `test_models` |
| BR-13 | `MeetingSlot` unique constraint | model; `test_models` |
| BR-14 | `ScheduleRun.Status` and scoring | engine runner; `test_engines` |
| BR-15 | Import preview token workflow | `ImportCommitView`; `test_import` |
| BR-16 | Settings validation and serializer fallback | `timetable/models.py` helpers; `test_api` |

## Known traceability gaps

- No dedicated automated test for the audit-log read API.
- No dedicated automated test for conflict-resolution list/resolve/ignore views.
- No automated test for term management because it is Django-admin-only.
- Export tests currently fail; the requirement remains implemented but
  unverified by a green suite.
- NFR-03 is documented as a known gap rather than an implemented control.
- Full-suite failures include API route/login drift, export routing, demo-command
  drift, and scalability/stress limits; see [Testing](testing.md).

## Related documentation

- [Requirements](requirements.md)
- [Use cases](use-cases.md)
- [Testing](testing.md)
- [API reference](api-reference.md)
