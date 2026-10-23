# Schedule Maker — Backend

Django REST API and pure-Python scheduling engines for Schedule Maker. This
page is the backend setup and runbook. For requirements, architecture, data
model, diagrams, security, and the complete endpoint catalog, use the
[documentation set](../docs/README.md).

## Requirements

- Python 3.14
- SQLite for development (configured in `core/settings.py`)
- No external services are required for local development

## First-time setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API is served at `http://127.0.0.1:8000/api/`.

| Resource | URL |
| --- | --- |
| Swagger UI | `http://127.0.0.1:8000/api/schema/swagger-ui/` |
| ReDoc | `http://127.0.0.1:8000/api/schema/redoc/` |
| OpenAPI schema | `http://127.0.0.1:8000/api/schema/` |
| Django admin | `http://127.0.0.1:8000/admin/` |

## Accounts and terms

Create a registrar account:

```bash
python manage.py createsuperuser
```

Registrar accounts use Django's `is_staff` flag. Create professor accounts and
professor profiles through `/admin/`; professors cannot access the Django admin
site.

Academic terms are managed through Django admin. There is currently no
`/api/admin/terms/` endpoint. Activate one term before generating a schedule.
The database does not enforce a single active term, so activate terms carefully.

## Configuration

Settings are in `core/settings.py`. The repository currently has no
environment-variable loader; do not use the checked-in development settings as
production configuration. See [Configuration](../docs/configuration.md) for
settings tables and the production checklist.

Default local database:

```text
backend/db.sqlite3
```

## Demo dataset

The demo command seeds a realistic catalog, professors, assignments, and
availability, then generates schedules against a running server.

Terminal 1:

```bash
python manage.py runserver
```

Terminal 2:

```bash
python manage.py demo_schedule
python manage.py demo_schedule --scale large
python manage.py demo_schedule --reset
```

Useful options:

| Option | Purpose |
| --- | --- |
| `--scale normal\|large\|full` | Dataset size; `normal` is the default |
| `--algorithm greedy\|min_conflicts\|backtracking\|all` | Algorithm(s) to run |
| `--time-limit SECONDS` | Per-algorithm time limit |
| `--section NAME` | Filter the printed schedule |
| `--reset` | Delete old demo schedules, assignments, and availability first |
| `--base URL` | API base URL; default `http://127.0.0.1:8000/api` |
| `--allow-non-debug` | Allow the fixed-password demo outside `DEBUG`; never use in production |

Demo meetings use the registrar-configured duration defaults for their mode.
The defaults are `async` 1 hour, `sync` 2 hours, and `lab` 3 hours unless
changed in Global Settings. Explicit durations in a demo fixture override the
default. Re-run the command after changing settings; use `--reset` to clear old
demo schedules first.

## Common commands

```bash
# Apply migrations
python manage.py migrate

# Check the project
python manage.py check

# Check for missing migrations
python manage.py makemigrations --check --dry-run

# Run all tests
python manage.py test

# Run one module
python manage.py test timetable.tests.test_analytics

# Generate the committed OpenAPI schema
python manage.py spectacular --file ../docs/api/openapi.yaml
```

## Test status

The full suite is **not green**. Django currently discovers 291 tests and the
full run reports 15 failures and 13 errors, concentrated in legacy API,
demo-command, scalability, and export tests. Targeted analytics, RBAC, JWT,
edge-case, stress, and engine suites pass.

See [Testing](../docs/testing.md) for the module breakdown, known failures, and
the manual smoke-test checklist.

## Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401` “Authorization header must contain two space-delimited values” | Missing `Bearer` prefix | Send `Authorization: Bearer <token>` |
| `401` invalid or expired refresh token | Refresh token expired or rotated | Log in again |
| `403` on writes | User is not staff | Use a registrar account |
| Generation returns `400` “No active term” | No active term | Activate a term in Django admin |
| Public schedule is empty | No published run | Publish a run first |
| Import commit fails | Preview token expired | Re-run preview and commit within 15 minutes |
| `429` | Usually a proxy limit; app login throttle is not attached | Check the proxy |
| `database is locked` | Concurrent SQLite writes | Use one process or a production database |

## Project layout

```text
backend/
├── core/           settings and URL routing
├── users/          authentication and professor profiles
├── catalog/        departments, rooms, subjects, sections
├── timetable/      assignments, availability, schedules, analytics
│   ├── engines/    pure-Python scheduling algorithms
│   └── analytics/  registrar metrics and conflict auditor
├── data_transfer/  spreadsheet import and export
├── manage.py
└── db.sqlite3      development database
```

## Further reading

- [Documentation index](../docs/README.md)
- [API reference](../docs/api-reference.md)
- [Architecture](../docs/architecture.md)
- [Data flow and DFDs](../docs/data-flow.md)
- [Scheduling engine](../docs/scheduling-engine.md)
- [Deployment](../docs/deployment.md)
- [Contributing](../CONTRIBUTING.md)
