# Testing

This page describes the automated test strategy, how to run the suite, what is
covered, and which failures are currently known.

> **Current status:** the full suite is not green. At the time of writing,
> Django discovers **291 tests** and the full run reports **15 failures and
> 13 errors** after about four minutes. The failures are concentrated in legacy
> API, demo-command, large-scale, and export tests. Do not treat a full-suite
> run as a release gate yet; triage the known failures first.

## Running the tests

Run all backend tests from the `backend/` directory:

```bash
cd backend

# Use the project's virtual environment
source .venv/bin/activate

python manage.py test
```

Useful variants:

```bash
# One module
python manage.py test timetable.tests.test_engines

# One test case or test
python manage.py test timetable.tests.test_analytics.AnalyticsPermissionTests
python manage.py test timetable.tests.test_engines.GreedyEngineTests.test_greedy_places_every_meeting

# Keep the test database between runs while debugging
python manage.py test timetable.tests.test_api --keepdb

# More detail
python manage.py test timetable.tests.test_analytics -v 2
```

Django creates an isolated test database, applies migrations, and destroys it
after the run. No development data in `backend/db.sqlite3` is used or changed.

Before opening a pull request, also run:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
```

## Test architecture

| Area | Approach |
| --- | --- |
| Models and constraints | Django `TestCase` with direct ORM assertions |
| Engines | `SimpleTestCase`; pure Python engines need no database |
| API and RBAC | DRF `APITestCase` with JWT `Token` authentication headers |
| Import/export | `TestCase`/`APITestCase` with generated XLSX, CSV ZIP, and PDF responses |
| Factories | `factory_boy` factories in `backend/timetable/tests/factories.py` |
| Determinism | Min-conflicts accepts a seed; tests use fixed seeds where behavior depends on randomness |
| Database | SQLite test database created by Django |

The suite is intentionally layered: engine tests run without Django, model tests
check database rules, API tests exercise serializers and permissions, and the
end-to-end test drives login, catalog setup, generation, and schedule retrieval
over HTTP.

## Coverage by module

| Module | What it verifies |
| --- | --- |
| `timetable.tests.test_models` | Assignment uniqueness, meeting rules, time ranges, `end_time` |
| `timetable.tests.test_engines` | Greedy, backtracking, min-conflicts, hard constraints, infeasibility, scoring, department rules |
| `timetable.tests.test_scenario_builder` | Database-to-engine mapping, term filtering, availability, busy blocks, limits |
| `timetable.tests.test_api` | Authentication, catalog CRUD, availability, generation, assignment validation, settings, schedule views, full flow |
| `timetable.tests.test_rbac` | Registrar, professor, and anonymous access boundaries |
| `timetable.tests.test_jwt_auth` | Login, refresh, verify, logout/blacklist, `/me`, legacy token endpoints |
| `timetable.tests.test_analytics` | Analytics selection, pagination, partial-overlap detection, coverage, workload, rooms, sections, quality |
| `timetable.tests.test_edge_cases` | Boundary conditions, overlapping terms, mid-term changes, single-room cases |
| `timetable.tests.test_stress` | Load, stress, concurrency, and edge-case behavior |
| `timetable.tests.test_scalability` | Larger generated datasets and algorithm comparison |
| `timetable.tests.test_demo_schedule` | Demo seeding, defaults, and command behavior |
| `data_transfer.tests.test_import` | Preview, validation, commit, templates, import processor units |
| `data_transfer.tests.test_export` | XLSX and PDF export content, headers, permissions |

The analytics, RBAC, JWT, edge-case, stress, and engine suites are the best
starting point when validating a change to scheduling or access control.

## Current known failures

These results were captured from the `staging`-based documentation branch and
should be re-checked before release. They are pre-existing failures, not
documentation changes.

| Area | Result | Representative tests / cause |
| --- | --- | --- |
| `timetable.tests.test_api` | 6 failures, 5 errors | API root contents, legacy login path, generation setup, class filters, own-schedule views |
| `timetable.tests.test_demo_schedule` | 2 errors | Demo test mocks and a `_seed_users` signature mismatch |
| `timetable.tests.test_scalability` | 2 failures | 100- and 200-section loads produce consecutive-hour hard violations |
| `data_transfer` | 7 failures, 3 errors | XLSX/PDF export contents, headers, and permission checks |
| Combined full run | 3 additional failures/errors | Appear only when suites share process state; likely test isolation/order |

Known examples from the isolated runs:

- `test_api_root_lists_all_resources_once`
- `test_generate_happy_path`
- `test_classes_include_end_time`
- `test_seed_users_reconciles_registrar_and_professor_department`
- `test_100_sections_load`
- `test_xlsx_contains_schedule_row`
- `test_pdf_has_valid_magic_bytes`

When fixing these, prefer fixing the underlying behavior or the stale test
expectation rather than weakening assertions. In particular:

- The generation tests and demo tests were written against earlier endpoint
  paths, response keys, and command signatures.
- The scalability failures expose a real constraint interaction: at large
  meeting counts the engine can produce consecutive-hour violations. Treat this
  as a product/engine issue, not only a test issue.
- Export failures should be checked against the current registrar-only
  permission model and the generated file contents.

## What is not covered

- Browser or frontend testing: the React frontend is not implemented.
- Student, enrollment, and program-domain behavior: those models do not exist.
- Production deployment, TLS, reverse proxy, and multi-process cache behavior.
- Load testing at production scale beyond the synthetic scalability cases.
- Automatic audit-log and conflict-resolution record creation, because those
  writes are not implemented.
- A CI pipeline: the repository currently has no workflow configuration, so
  checks must be run locally.

## Manual smoke test

Use this checklist after a significant change:

1. `python manage.py check` and `makemigrations --check --dry-run` are clean.
2. Log in with a registrar account and obtain access/refresh tokens.
3. Create or verify a term, department, room, subject, section, professor, and
   assignment with at least one `sync` or `lab` meeting.
4. Generate a schedule with each algorithm; confirm the run is persisted and
   that infeasible runs still return a run ID.
5. Review conflicts, publish a run, and fetch the published schedule without
   authentication.
6. Log in as a professor and confirm only that professor's schedule and
   availability are visible.
7. Preview and commit a small import; export the resulting run to XLSX and PDF.
8. Review the analytics endpoints and confirm the selected term/run in `meta`.

See [Requirements](requirements.md) for acceptance references and
[Operations](operations.md) for operational commands.
