# Schedule Maker

A web application that turns a professor's teaching inputs — the subjects and
sections they handle, plus the times they are available — into a single weekly
timetable spread across Monday to Saturday.

The system models an academic institution (departments, rooms, sections,
subjects, professor workloads), then searches for a conflict-free timetable
using three interchangeable scheduling algorithms. Because each algorithm is
measured on the same input with the same scoring function, results can be
compared directly by runtime and schedule quality.

## Key features

- **Three scheduling engines** — `greedy`, `min-conflicts`, and CSP-based
  `backtracking` — all producing the same output shape so they can be compared.
- **Quality scoring** — a single soft-score shared by every engine measures how
  well a timetable spreads each professor's load across the week and how close
  it stays to their preferred windows.
- **Per-meeting modes** — every weekly meeting is labelled `async`, `sync`, or
  `lab`, each with a default length that a registrar can override.
- **Department-scoped rooms** — a professor is only placed in rooms of their own
  department; unassigned rooms are shared.
- **Rule enforcement** — hard constraints (no double-booked professor, section,
  or room; capacity respected; availability honoured) are checked for every
  generated schedule, and each subject load is required to keep at least one
  synchronous class per week.
- **Role-based access** — registrars manage data and generate schedules;
  professors manage their own availability and view their own timetable.
- **Interactive API docs** — Swagger UI and ReDoc generated from the API schema.

## Architecture

```
frontend/ (planned)        backend/
React + Vite SPA   ──────▶  Django REST API
                            ├─ users/     authentication & professor profiles
                            ├─ catalog/   departments, subjects, sections, rooms
                            ├─ timetable/ assignments, availability, schedules
                            │              └─ engines/   pure-Python solver
                            └─ core/      settings & routing
```

The scheduling engine in `backend/timetable/engines/` is pure Python with no
Django imports, so the algorithms can be read, tested, and reused on their own.
`backend/timetable/scenario_builder.py` is the single adapter that turns the
database into an engine input.

## Tech stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Backend   | Django, Django REST Framework, drf-spectacular      |
| Engine    | Pure Python (no framework dependency)               |
| Database  | SQLite (development)                                |
| Frontend  | React + Vite (planned)                              |
| Auth      | Token authentication                                |

## Repository structure

```
├── backend/          Django REST API + scheduling engine
├── frontend/         React frontend (not yet scaffolded)
├── backend/README.md Full setup, API and demo guide
└── CONTRIBUTING.md   Workflow for contributing (branching, PRs)
```

## Quickstart

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/api/`. Interactive docs:

- Swagger UI — `http://127.0.0.1:8000/api/schema/swagger-ui/`
- ReDoc — `http://127.0.0.1:8000/api/schema/redoc/`

See [backend/README.md](backend/README.md) for account creation, the full API
walkthrough, and how to run the built-in demo dataset.

## Testing

```bash
cd backend
python manage.py test
```

The 80-test suite covers data rules, all three engines (including cases where
the algorithms differ), security, meeting modes, and a full end-to-end flow over
HTTP.

## License

All rights reserved.
