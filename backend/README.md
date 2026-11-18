# Schedule Maker — Backend

Django REST API and pure-Python scheduling engines for Schedule Maker. This
page is the backend setup and runbook. For requirements, architecture, data
model, diagrams, security, and the complete endpoint catalog, use the
[documentation set](../docs/README.md).

## Requirements

- Python 3.14
- SQLite for development (configured in `core/settings.py`); PostgreSQL is
  planned for production
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
| Health check | `http://127.0.0.1:8000/api/health/` |
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
settings tables and [Deployment](../docs/deployment.md) for production guidance.

Default local database:

```text
backend/db.sqlite3
```

## Demo dataset

The demo command seeds a realistic catalog, professors, assignments, and
availability, then generates schedules against a running server. It is
development-only. See [Operations: Demo environment](../docs/operations.md#demo-environment)
for the workflow, options, and duration-default behavior.

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

The full suite currently has known failures. See [Testing](../docs/testing.md)
for the current result, affected areas, and the manual smoke-test checklist.

## Common problems

See [Operations: Troubleshooting](../docs/operations.md#troubleshooting) for
symptom, cause, and fix guidance.

## Further reading

- [Documentation index](../docs/README.md)
- [API reference](../docs/api-reference.md)
- [Architecture](../docs/architecture.md)
- [Scheduling engine](../docs/scheduling-engine.md)
- [Deployment](../docs/deployment.md)
- [Contributing](../CONTRIBUTING.md)
