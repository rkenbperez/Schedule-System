# Operations

This runbook covers the day-to-day operation of the Schedule Maker backend:
starting the service, seeding a demo, preparing a term, generating and
publishing schedules, importing data, exporting results, and handling common
failures.

All examples assume the API is running at `http://127.0.0.1:8000` and that a
registrar access token is available in `$TOKEN`. Replace placeholder IDs and
tokens with real values.

## Service startup

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver
```

Health and documentation endpoints:

| URL | Purpose |
| --- | --- |
| `GET /api/` | API root |
| `GET /api/health/` | Database health check |
| `GET /api/schema/` | OpenAPI schema |
| `/api/schema/swagger-ui/` | Interactive Swagger UI |
| `/api/schema/redoc/` | ReDoc |
| `/admin/` | Django admin (staff only) |

The development server is single-process and uses SQLite. Do not run it as a
production service. See [Deployment](deployment.md) for the recommended
production topology.

## Authentication

```bash
curl -X POST http://127.0.0.1:8000/api/auth/jwt/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "registrar", "password": "your-password"}'
```

Store the returned `access` token:

```bash
export TOKEN="<access-token>"
```

Use `Authorization: Bearer $TOKEN` for protected requests. Refresh with
`POST /api/auth/jwt/refresh/`, check the current role with
`GET /api/auth/jwt/me/`, and blacklist the refresh token with
`POST /api/auth/jwt/logout/`.

> The custom login throttle is defined but not attached to the login view. Do
> not rely on application-level brute-force protection; use a reverse proxy or
> API gateway rate limit.

## Term setup

Terms are managed through Django admin, not through a public API route:

1. Log in to `/admin/` as a staff user.
2. Open **Academic terms**.
3. Create the year/semester record, set start and end dates, and mark it
   active.
4. Activate only one term at a time. The database does not enforce this rule.

Schedule generation always uses the active term. Analytics can select another
term explicitly, but generation cannot.

## Catalog and people setup

Registrars maintain departments, rooms, subjects, sections, professors, and
assignments.

```bash
# Department
curl -X POST http://127.0.0.1:8000/api/departments/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CS"}'

# Room owned by that department
curl -X POST http://127.0.0.1:8000/api/rooms/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CS-101", "capacity": 40, "department": 1}'

# Subject and section
curl -X POST http://127.0.0.1:8000/api/subjects/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "CS101", "title": "Introduction to Computing", "units": 3}'

curl -X POST http://127.0.0.1:8000/api/sections/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "BSIT-1A", "headcount": 35, "program": "BSIT", "year_level": 1, "term": 1}'
```

Professor accounts and their profiles are normally created through Django
admin. The API exposes professor records at `/api/profs/`, but the one-to-one
link between an auth user and a professor profile is an administrative
operation.

## Assignments and meetings

An assignment links a professor, subject, section, and term. It must contain at
least one meeting, and at least one meeting must be `sync` or `lab`.

```bash
curl -X POST http://127.0.0.1:8000/api/assignments/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prof": 1,
    "subject": 1,
    "section": 1,
    "meetings": [
      {"mode": "sync", "order": 1},
      {"mode": "lab", "order": 2},
      {"mode": "async", "order": 3}
    ]
  }'
```

If `duration_slots` is omitted, the registrar-configured default for the mode
is used. Send an explicit value to override it for one meeting. Existing
meetings are never changed by a settings update.

Bulk workflows are available at `POST /api/admin/assignments/bulk/` and
`POST /api/admin/sections/bulk/`.

## Global duration defaults

The seeded settings are:

| Key | Default |
| --- | --- |
| `async_duration_default` | `1` hour |
| `sync_duration_default` | `2` hours |
| `lab_duration_default` | `3` hours |

Read them with `GET /api/settings/`. Update one setting with a single PATCH, or
update several with a bulk PATCH:

```bash
curl -X PATCH http://127.0.0.1:8000/api/settings/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settings": [
    {"key": "sync_duration_default", "value": 2},
    {"key": "lab_duration_default", "value": 3}
  ]}'
```

Bulk PATCH returns `{"updated": [...], "errors": [...]}` with HTTP 200 even if
some entries fail validation. Check the `errors` array. Duration values must be
positive whole numbers.

## Demo environment

The demo command seeds departments, professors, subjects, sections, rooms,
assignments, availability, and schedules, then prints an algorithm comparison
and a weekly grid.

Terminal 1:

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Terminal 2:

```bash
cd backend
source .venv/bin/activate

# Default normal dataset
python manage.py demo_schedule

# Larger dataset
python manage.py demo_schedule --scale large

# Clear old demo schedules/assignments/availability first
python manage.py demo_schedule --reset

# Run one algorithm or all algorithms
python manage.py demo_schedule --algorithm all
```

Options also include `--base`, `--time-limit`, `--section`,
`--allow-non-debug`, and `--scale full`. The demo creates a fixed development
account and must not be used in production.

## Generate and review a schedule

```bash
# Generate with one algorithm
curl -X POST http://127.0.0.1:8000/api/schedules/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "greedy", "time_limit_s": 30}'
```

The response includes `run_id`, `algorithm`, `status`, `feasible`,
`runtime_ms`, `soft_score`, `class_count`, `violations`, and `unplaced`.
Infeasible runs are persisted so they can be inspected.

```bash
# List runs
curl http://127.0.0.1:8000/api/schedules/runs \
  -H "Authorization: Bearer $TOKEN"

# Inspect a run and its classes
curl http://127.0.0.1:8000/api/schedules/runs/1 \
  -H "Authorization: Bearer $TOKEN"
curl "http://127.0.0.1:8000/api/schedules/runs/1/classes?prof=1&day=0" \
  -H "Authorization: Bearer $TOKEN"

# Dynamically calculated conflicts
curl http://127.0.0.1:8000/api/admin/schedules/runs/1/conflicts/ \
  -H "Authorization: Bearer $TOKEN"
```

Conflict detection is computed from the stored classes. It does not create
`ConflictResolution` rows automatically.

### Publish and verify public access

```bash
curl -X PATCH http://127.0.0.1:8000/api/admin/schedules/runs/1/publish/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published": true}'
```

The body must contain a JSON boolean. Then verify the public endpoints without
a token:

```bash
curl http://127.0.0.1:8000/api/public/schedules/
curl http://127.0.0.1:8000/api/public/schedules/2024-1/
curl http://127.0.0.1:8000/api/public/schedules/2024-1/sections/1/
```

If a term has no published run, the public term endpoint returns an empty
result or a message rather than unpublished classes.

## Analytics

```bash
curl "http://127.0.0.1:8000/api/admin/analytics/overview/?term=2024-1" \
  -H "Authorization: Bearer $TOKEN"

curl "http://127.0.0.1:8000/api/admin/analytics/workload/?department=1&limit=25" \
  -H "Authorization: Bearer $TOKEN"

curl "http://127.0.0.1:8000/api/admin/analytics/quality/?algorithm=greedy&status=feasible" \
  -H "Authorization: Bearer $TOKEN"
```

The default run selection is the latest published run, then the latest feasible
run, then the latest run. Supply `run` to pin a specific run. Every response has
a `meta` object showing the selected term, run, and selection reason. See
[API reference](api-reference.md) for filters and pagination.

## Import data

```bash
# Download a template
curl -O http://127.0.0.1:8000/api/imports/template/ \
  -H "Authorization: Bearer $TOKEN"

# Preview a spreadsheet
curl -X POST http://127.0.0.1:8000/api/imports/preview/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@catalog.xlsx"

# Commit the preview token
curl -X POST http://127.0.0.1:8000/api/imports/commit/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preview_token": "<token-from-preview>"}'
```

Import sheets are processed in dependency order: Departments, Rooms, Subjects,
Sections, Professors, Assignments, Meetings, Availability, BusyBlocks. A preview
is valid only when the whole workbook passes validation. Preview data is held in
the Django cache for 15 minutes; if the preview expires, upload the file again.
The default local-memory cache is per process, so a multi-process deployment
needs a shared cache backend.

## Export a schedule

```bash
curl -OJ http://127.0.0.1:8000/api/exports/schedules/1.xlsx \
  -H "Authorization: Bearer $TOKEN"

curl -OJ http://127.0.0.1:8000/api/exports/schedules/1.pdf \
  -H "Authorization: Bearer $TOKEN"
```

Exports are registrar-only and return file attachments. There is no analytics
export yet.

## Audit and conflict-resolution records

The read APIs are available, but the current codebase does not automatically
write records:

- `GET /api/audit/` reads `AuditLog` rows with action/model/user/date filters.
- `GET /api/admin/schedules/runs/<run_id>/conflict-resolutions/` lists stored
  conflict-resolution records.
- `POST /api/admin/conflict-resolutions/<pk>/resolve/` and `/ignore/` update
  existing records.

Do not expect a generated schedule or a detected conflict to create these rows.
Treat the APIs as a foundation for future instrumentation, not as a complete
audit trail.

## Backup and restore

For development, stop the server and copy the SQLite database:

```bash
cp backend/db.sqlite3 backend/db.sqlite3.backup
```

Restore by replacing the file while the server is stopped and running
`python manage.py migrate` if the schema changed. Do not copy a live database
while writes are in progress.

For production, use the database vendor's backup and point-in-time recovery
mechanisms. See [Deployment](deployment.md).

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `401` with “Authorization header must contain two space-delimited values” | Missing `Bearer` prefix | Send `Authorization: Bearer <token>` |
| `401` / expired token | Access token lifetime is one hour | Refresh or log in again |
| `403` on catalog writes | User is not staff | Use a registrar account |
| Generate returns `400` “No active term” | No term is marked active | Activate a term in Django admin |
| Generate returns `400` unknown algorithm | Algorithm outside `greedy`, `min_conflicts`, `backtracking` | Use a supported value |
| Run is infeasible or meetings are unplaced | Availability, capacity, department ownership, limits, or time limit | Inspect `violations`/`unplaced`, relax constraints, or raise `time_limit_s` |
| Public schedule is empty | No run is published for the term | Publish a run first |
| Import preview fails | Missing sheet/column or invalid row | Read `errors[].sheet`, `row`, `field`, `message` |
| Import commit fails | Preview token expired or cache lost | Re-run preview and commit within 15 minutes |
| `429 Too Many Requests` | Usually a proxy/gateway limit; app login throttle is not attached | Check proxy configuration |
| SQLite “database is locked” | Concurrent writes against SQLite | Run one process or move to a production database |
| Demo command fails | Server not running, wrong `--base`, or `DEBUG` off | Start the server and pass the correct base URL |

## Operational checklist

- [ ] Active term set and verified.
- [ ] Catalog, professors, and assignments validated.
- [ ] At least one `sync` or `lab` meeting per assignment.
- [ ] Schedule generated with the intended algorithm and time limit.
- [ ] Conflicts reviewed; infeasible runs investigated.
- [ ] Run published and public endpoints checked.
- [ ] Import preview committed before the token expires.
- [ ] Exports verified for the published run.
- [ ] Analytics summary reviewed for the active term.
- [ ] Database backed up before bulk imports or releases.

## Related documentation

- [API reference](api-reference.md)
- [Configuration](configuration.md)
- [Deployment](deployment.md)
- [Testing](testing.md)
- [Troubleshooting in the backend README](../backend/README.md)
