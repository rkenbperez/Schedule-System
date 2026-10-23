# Requirements

This page defines the implemented functional scope, business rules, and
non-functional expectations. Requirement identifiers are referenced by the
[use cases](use-cases.md) and the [traceability matrix](traceability.md).

## Functional requirements

### Authentication and access control

| ID | Requirement | Status |
| --- | --- | --- |
| FR-AUTH-01 | The system shall authenticate a user with a username and password and issue an access token and a refresh token. | Implemented |
| FR-AUTH-02 | The system shall allow an access token to be refreshed and a refresh token to be verified. | Implemented |
| FR-AUTH-03 | The system shall allow a client to blacklist a refresh token on logout. | Implemented |
| FR-AUTH-04 | The system shall expose the current user's identity and role through `/api/auth/jwt/me/`. | Implemented |
| FR-AUTH-05 | The system shall keep legacy simplejwt endpoints available for compatibility. | Legacy |
| FR-AUTH-06 | The system shall restrict registrar operations to authenticated staff users. | Implemented |
| FR-AUTH-07 | The system shall restrict professor self-service operations to the authenticated professor's own records. | Implemented |
| FR-AUTH-08 | The system shall allow anonymous read-only access to published schedule endpoints. | Implemented |

### Academic structure

| ID | Requirement | Status |
| --- | --- | --- |
| FR-TERM-01 | The system shall represent an academic term by year, semester, start date, end date, and active flag. | Implemented |
| FR-TERM-02 | The system shall prevent duplicate year/semester combinations. | Implemented |
| FR-TERM-03 | The system shall provide a term code in `YYYY-S` form and a human-readable term name. | Implemented |
| FR-TERM-04 | The system shall use the active term for schedule generation; analytics shall use it by default and allow explicit term selection. | Implemented |
| FR-TERM-05 | Academic terms shall be manageable through Django admin; no term CRUD route is currently exposed under `/api/`. | Known gap |
| FR-CAT-01 | The system shall provide CRUD operations for departments, rooms, subjects, and sections. | Implemented |
| FR-CAT-02 | The system shall enforce unique names for departments and rooms, unique subject codes, and unique section names. | Implemented |
| FR-CAT-03 | The system shall record section headcount, program label, year level, and optional term. | Implemented |
| FR-CAT-04 | The system shall record room capacity, building, and optional owning department. | Implemented |
| FR-PROF-01 | The system shall maintain a professor profile linked one-to-one to an authentication user. | Implemented |
| FR-PROF-02 | The system shall record the professor's department and daily/consecutive-hour limits. | Implemented |
| FR-PROF-03 | A professor shall manage their own availability windows and busy blocks. | Implemented |
| FR-PROF-04 | The system shall allow registrars to manage professor records through the API and Django admin. | Implemented |

### Assignments and meetings

| ID | Requirement | Status |
| --- | --- | --- |
| FR-ASG-01 | The system shall link a professor, subject, section, and term in an assignment. | Implemented |
| FR-ASG-02 | The system shall prevent duplicate assignments for the same professor, subject, section, and term. | Implemented |
| FR-ASG-03 | An assignment shall contain one or more weekly meeting slots. | Implemented |
| FR-ASG-04 | Each meeting shall have a mode: `async`, `sync`, or `lab`. | Implemented |
| FR-ASG-05 | Each meeting shall have a positive whole-hour duration. | Implemented |
| FR-ASG-06 | When a meeting omits its duration, the system shall use the configured default for that mode. | Implemented |
| FR-ASG-07 | The registrar shall be able to override a meeting's duration explicitly. | Implemented |
| FR-ASG-08 | The system shall reject an assignment whose meetings contain no `sync` or `lab` meeting. | Implemented |
| FR-ASG-09 | Changing global duration defaults shall affect future meetings only, not existing records. | Implemented |
| FR-ASG-10 | The system shall allow bulk assignment creation for registrar workflows. | Implemented |

### Schedule generation and review

| ID | Requirement | Status |
| --- | --- | --- |
| FR-SCH-01 | The registrar shall generate a schedule for an academic term using a selected algorithm. | Implemented |
| FR-SCH-02 | Supported algorithms shall be `greedy`, `min_conflicts`, and `backtracking`. | Implemented |
| FR-SCH-03 | The engine shall respect room, professor, and section non-overlap; availability; busy blocks; capacity; department room ownership; daily hours; and consecutive-hour limits. | Implemented |
| FR-SCH-04 | The engine shall place every required meeting or report the unplaced meetings. | Implemented |
| FR-SCH-05 | The system shall persist every generation attempt as a schedule run, including infeasible runs. | Implemented |
| FR-SCH-06 | The system shall record runtime, feasibility status, quality score, algorithm, term, author, and breakdown. | Implemented |
| FR-SCH-07 | The registrar shall list and inspect schedule runs and their classes. | Implemented |
| FR-SCH-08 | The registrar shall inspect dynamically calculated conflicts for a run. | Implemented |
| FR-SCH-09 | The registrar shall publish a run; public endpoints shall expose only published runs. | Implemented |
| FR-SCH-10 | A professor shall view their own schedule across relevant runs. | Implemented |
| FR-SCH-11 | The system shall expose analytics for coverage, quality, workload, rooms, and sections. | Implemented |

### Data transfer and advanced features

| ID | Requirement | Status |
| --- | --- | --- |
| FR-DATA-01 | The system shall preview spreadsheet imports before committing them. | Implemented |
| FR-DATA-02 | The system shall issue a preview token and require it for import commit. | Implemented |
| FR-DATA-03 | The system shall provide Excel and CSV template downloads. | Implemented |
| FR-DATA-04 | The system shall export a schedule run as XLSX and PDF. | Implemented |
| FR-DATA-05 | The system shall provide read access to audit-log records with filters. | Implemented |
| FR-DATA-06 | Business operations shall automatically write audit-log records. | Known gap |
| FR-DATA-07 | The system shall manage global settings, including mode duration defaults. | Implemented |
| FR-DATA-08 | The system shall validate duration settings as positive integers. | Implemented |
| FR-DATA-09 | The system shall list, resolve, and ignore conflict-resolution records. | Implemented |
| FR-DATA-10 | Generating a schedule or detecting a conflict shall automatically create conflict-resolution records. | Known gap |

## Business rules

| ID | Rule | Enforcement |
| --- | --- | --- |
| BR-01 | Schedule generation always uses the active term; analytics may select another term. | Application logic |
| BR-02 | A professor may only be placed in a room owned by their department; unowned rooms are shared. | Engine constraint |
| BR-03 | Every assignment must include at least one `sync` or `lab` meeting. | Serializer validation |
| BR-04 | Meeting durations must be at least one hour. | Model check constraint and serializer |
| BR-05 | Availability and busy-block ranges must have start before end and a day in Monday-Saturday. | Model check constraints |
| BR-06 | A room, professor, or section cannot host overlapping classes. | Engine hard constraint and conflict auditor |
| BR-07 | A class cannot exceed its room capacity. | Engine hard constraint and conflict auditor |
| BR-08 | A professor cannot exceed daily or consecutive-hour limits. | Engine hard constraint and conflict auditor |
| BR-09 | Published schedules are public; unpublished schedules require authentication. | Permission classes and queryset filters |
| BR-10 | Only staff users may modify catalog data, assignments, settings, or published state. | Permission classes |
| BR-11 | Professors may modify only their own availability and busy blocks. | Object-level ownership checks |
| BR-12 | Department, room, subject code, and section name values are unique. | Database unique constraints |
| BR-13 | Meeting order is unique within an assignment. | Database unique constraint |
| BR-14 | A schedule run is either `feasible` or `infeasible`; quality score is meaningful for feasible runs. | Model choices and engine |
| BR-15 | Import commit is allowed only with a valid preview token. | Import workflow |
| BR-16 | Global duration defaults are positive whole hours and apply only when a meeting omits a duration. | Settings validation and serializer fallback |

The “one active term at a time” behavior is an operational convention. The
database does not currently enforce a single active term; use Django admin
carefully when activating terms.

## Non-functional requirements

| ID | Area | Expectation | Current state |
| --- | --- | --- | --- |
| NFR-01 | Security | Authenticated and role-scoped access; secrets not stored in source control | JWT and RBAC implemented; `SECRET_KEY` and `DEBUG` are development-only gaps |
| NFR-02 | Security | Refresh-token rotation and blacklist on logout | Implemented |
| NFR-03 | Security | Login brute-force protection | Known gap: `LoginRateThrottle` is defined but not attached to the login view; use proxy-level limits |
| NFR-04 | Performance | Schedule generation returns within a usable interactive time for demo-scale data | Demo-scale runs complete in milliseconds to seconds; large inputs are request-blocking |
| NFR-05 | Scalability | Support the institution's catalog size without unbounded memory growth | Tests exercise up to 1000 sections; no production capacity benchmark |
| NFR-06 | Reliability | Persist failed generation attempts for diagnosis | Implemented |
| NFR-07 | Reliability | Avoid partial schedule writes | Generation writes within a transaction |
| NFR-08 | Maintainability | Engine independent of Django | Implemented as pure Python |
| NFR-09 | Testability | Deterministic unit/API tests for rules and engines | 207 test methods (291 tests discovered); known pre-existing failures |
| NFR-10 | Portability | Run on Python 3.14 and SQLite in development | Implemented |
| NFR-11 | Operability | Generated API schema and interactive documentation | drf-spectacular, Swagger UI, ReDoc |
| NFR-12 | Observability | Trace important actions | Audit-log model and read API exist; automatic writes are a known gap |
| NFR-13 | Usability | Predictable JSON errors and pagination | DRF defaults; analytics uses a limit/offset envelope |
| NFR-14 | Compatibility | Keep legacy token and statistics endpoints working | Implemented and documented as legacy |

## Out of scope

- Student, enrollment, and program-domain features.
- Automatic timetable repair after conflicts are reviewed.
- Background job processing for long schedule runs.
- Frontend implementation and browser-based usability testing.
- Production SLA, high availability, and disaster recovery guarantees.

## Acceptance references

The main automated coverage lives in:

- `backend/timetable/tests/test_models.py` — model rules and constraints
- `backend/timetable/tests/test_engines.py` — algorithm behavior
- `backend/timetable/tests/test_api.py` — API generation and schedule views
- `backend/timetable/tests/test_rbac.py` — role permissions
- `backend/timetable/tests/test_jwt_auth.py` — authentication
- `backend/timetable/tests/test_analytics.py` — analytics endpoints
- `backend/data_transfer/tests/` — import/export workflows

See [Testing](testing.md) for commands and known failures.
