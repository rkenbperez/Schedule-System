# Schedule Maker

Schedule Maker is a Django REST API that turns academic workloads into a weekly
timetable. Registrars define departments, rooms, subjects, sections, professors,
and assignments; each assignment carries one or more weekly meetings with an
`async`, `sync`, or `lab` mode. The scheduler places those meetings while
respecting room, professor, section, availability, capacity, and work-limit
rules.

Three interchangeable engines — `greedy`, `min_conflicts`, and `backtracking` —
produce comparable runs. Every run records runtime, feasibility, and soft-score
quality so the algorithms can be evaluated on the same input.

## Project status

| Area | Status |
| --- | --- |
| Backend API and scheduling engines | Implemented |
| Registrar analytics | Implemented |
| Spreadsheet import/export | Implemented; export tests have known failures |
| Frontend | Planned; not scaffolded |
| Student, enrollment, and program features | Not implemented |
| Production hardening | Not implemented |

The latest release tag is `v1.2.0`. The `staging` branch contains post-tag work,
including analytics and configurable meeting-duration defaults. See the
[changelog](CHANGELOG.md) for details.

## Key features

- **Three scheduling engines** — greedy, min-conflicts, and backtracking, with
  the same input and output contract.
- **Quality scoring** — one lower-is-better soft score measures weekly load
  spread, consecutive teaching hours, and preferred-window placement.
- **Per-meeting modes** — `async`, `sync`, and `lab` meetings with
  registrar-configurable default lengths and per-meeting overrides.
- **Hard-rule enforcement** — no professor, section, or room double-booking;
  capacity, availability, busy blocks, department room ownership, daily hours,
  and consecutive-hour limits are checked.
- **Academic terms** — schedules are scoped to First/Second Semester terms.
- **Role-based access** — registrars manage data and schedules; professors
  manage their own availability and view their own timetable; published
  schedules are public.
- **Registrar analytics** — coverage, workload, room utilization, section
  coverage, quality, and conflict summaries by term or run.
- **Data transfer** — XLSX/PDF exports and previewed spreadsheet imports.
- **API documentation** — generated OpenAPI schema with Swagger UI and ReDoc.

## Architecture

```text
frontend/ (planned)              backend/
React + Vite SPA  ───────────▶  Django REST API
                                 ├─ users/       authentication & professor profiles
                                 ├─ catalog/     departments, rooms, subjects, sections
                                 ├─ timetable/   assignments, schedules
                                 │   ├─ engines/ pure-Python solvers
                                 │   └─ analytics/ registrar metrics
                                 ├─ data_transfer/ import & export
                                 └─ core/        settings & routing
```

`backend/timetable/engines/` has no Django imports. The only database-to-engine
adapter is `backend/timetable/scenario_builder.py`.

## Quickstart

Requirements: Python 3.14.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/api/`.

| Resource | URL |
| --- | --- |
| Swagger UI | `http://127.0.0.1:8000/api/schema/swagger-ui/` |
| ReDoc | `http://127.0.0.1:8000/api/schema/redoc/` |
| OpenAPI schema | `http://127.0.0.1:8000/api/schema/` |
| Django admin | `http://127.0.0.1:8000/admin/` |

Create a registrar account with `python manage.py createsuperuser`. Academic
terms and professor profiles are managed through Django admin. See the
[backend runbook](backend/README.md) for the demo dataset and account setup.

## Documentation

The complete documentation set is in [`docs/`](docs/README.md):

| If you want to... | Read |
| --- | --- |
| Understand the system | [Introduction](docs/introduction.md) |
| Review requirements | [Requirements](docs/requirements.md) |
| See actors and workflows | [Use cases](docs/use-cases.md) |
| Understand the architecture | [Architecture](docs/architecture.md) |
| See the database | [Data model](docs/data-model.md) |
| See CFD and DFD diagrams | [Data flow](docs/data-flow.md) |
| Understand the solver | [Scheduling engine](docs/scheduling-engine.md) |
| Call the API | [API reference](docs/api-reference.md) |
| Review security | [Security](docs/security.md) |
| Configure or deploy | [Configuration](docs/configuration.md), [Deployment](docs/deployment.md) |
| Run and troubleshoot | [Testing](docs/testing.md), [Operations](docs/operations.md) |
| Trace requirements to tests | [Traceability](docs/traceability.md) |

## Testing

```bash
cd backend
python manage.py test
```

Django currently discovers 291 tests. The full suite is **not green**: at the
time of writing it reports 15 failures and 13 errors, concentrated in legacy API,
demo-command, scalability, and export tests. Targeted analytics, RBAC, JWT,
edge-case, stress, and engine suites pass. See [Testing](docs/testing.md) for the
current breakdown and the manual smoke-test checklist.

Before a pull request:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
```

## Repository structure

```text
├── backend/                    Django REST API and scheduling engine
├── docs/                       requirements, diagrams, API, operations
├── frontend/                   frontend placeholder (not implemented)
├── CHANGELOG.md                release and unreleased changes
├── CONTRIBUTING.md             branch, PR, and release workflow
└── README.md                   this landing page
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first push. Do not push
directly to `main` or `staging`; use a feature or fix branch and open a pull
request.

## License

All rights reserved. This repository is public for viewing, but no open-source
license is granted.
