# API Reference

This page describes the HTTP API exposed by the Django backend. It covers
authentication, shared conventions, and the curated endpoint catalog. Exact
request and response schemas are published in the generated
[OpenAPI document](api/openapi.yaml) and the live Swagger UI.

| Item | Value |
| --- | --- |
| Base URL (development) | `http://127.0.0.1:8000/api/` |
| Schema | `GET /api/schema/` |
| Swagger UI | `GET /api/schema/swagger-ui/` |
| ReDoc | `GET /api/schema/redoc/` |
| Content type | `application/json` unless noted |
| API versioning | None in the URL; the OpenAPI document is versioned separately |
| Authentication | JWT bearer tokens (legacy DRF token authentication is also enabled) |

## Authentication

The primary login endpoint returns a short-lived access token and a refresh
token. Send the access token on protected requests:

```http
Authorization: Bearer <access-token>
```

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/jwt/login/` | Public | Obtain an access and refresh token |
| `POST` | `/api/auth/jwt/refresh/` | Public | Exchange a refresh token for a new access token |
| `POST` | `/api/auth/jwt/verify/` | Public | Check whether a token is valid |
| `GET` | `/api/auth/jwt/me/` | Authenticated | Return the current user and role |
| `POST` | `/api/auth/jwt/logout/` | Authenticated | Blacklist a refresh token |

Token settings:

- Access tokens expire after **1 hour**.
- Refresh tokens expire after **7 days**.
- Refresh-token rotation and blacklist-after-rotation are enabled.
- Signing algorithm is HS256.
- The logout request body is `{"refresh": "<refresh-token>"}` and a successful
  logout returns **205 Reset Content**.

Legacy simplejwt endpoints remain available at `/api/token/`,
`/api/token/refresh/`, and `/api/token/verify/`. New clients should use the
`/api/auth/jwt/` endpoints.

### Login example

```bash
curl -X POST http://127.0.0.1:8000/api/auth/jwt/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "registrar", "password": "change-me"}'
```

```json
{
  "access": "<access-token>",
  "refresh": "<refresh-token>"
}
```

### Current-user example

```bash
curl http://127.0.0.1:8000/api/auth/jwt/me/ \
  -H "Authorization: Bearer <access-token>"
```

The response includes `id`, `username`, `email`, `first_name`, `last_name`,
`is_staff`, `role` (`registrar`, `professor`, or `user`), and a `professor`
object when the account has a professor profile.

> **Known gap:** the custom login throttle class exists, but it is not attached
> to the login view. Login attempts are therefore not currently rate-limited by
> the application. Use a reverse proxy or API gateway rate limit until this is
> fixed. See [Security](security.md).

## Authorization roles

| Role | Definition | Typical access |
| --- | --- | --- |
| Registrar | Authenticated Django user with `is_staff=True` | Full catalog, assignments, generation, analytics, settings, imports/exports, audit, publishing |
| Professor | Authenticated non-staff user linked to a `Professors` profile | Own availability, busy blocks, profile, schedule, and conflicts |
| Public | Anonymous visitor | Published schedules and read-only safety methods |
| Authenticated user | Any valid token holder | Read-only catalog and assignment data; own schedule classes where applicable |

Catalog and assignment endpoints are authenticated read-only for professors and
public-readable only where explicitly noted. The full matrix is in
[Security](security.md).

## Shared conventions

### Pagination

Standard list viewsets use DRF page-number pagination:

```json
{
  "count": 42,
  "next": "http://127.0.0.1:8000/api/assignments/?page=2",
  "previous": null,
  "results": []
}
```

Use `?page=<number>`. The default page size is **20**.

Analytics list endpoints use `limit`/`offset` instead:

- `limit`: 1–200, default 50.
- `offset`: zero or greater, default 0.
- Pagination metadata is returned in `meta.pagination`.

### Errors

Validation failures normally use DRF's field-keyed shape:

```json
{"meetings": ["At least one meeting is required."]}
```

Some custom views return `{"error": "..."}` or `{"detail": "..."}`. Common
status codes:

| Status | Meaning |
| --- | --- |
| `200 OK` | Successful read or update |
| `201 Created` | Resource or schedule run created |
| `205 Reset Content` | Refresh token blacklisted |
| `400 Bad Request` | Validation error, invalid selection, or malformed request |
| `401 Unauthorized` | Missing, invalid, or expired token |
| `403 Forbidden` | Authenticated but missing role permission |
| `404 Not Found` | Resource, term, run, or section not found |

### Filters and date formats

- Dates use ISO `YYYY-MM-DD`.
- Times use `HH:MM` (24-hour).
- Schedule days are integers `0`–`5` for Monday–Saturday.
- Term codes use `YYYY-S`, for example `2024-1`.
- Schedule-run `status` values are `feasible` and `infeasible`.

## Endpoint catalog

### Catalog and people

All CRUD endpoints support `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
Listing and reading require authentication; writes require the registrar role.

| Resource | Path | Notes |
| --- | --- | --- |
| Departments | `/api/departments/` | Unique name |
| Rooms | `/api/rooms/` | Capacity, building, optional owning department |
| Subjects | `/api/subjects/` | Unique code, title, units |
| Sections | `/api/sections/` | Headcount, program, year level, optional term |
| Professors | `/api/profs/` | One-to-one user profile, department, workload limits |
| Assignments | `/api/assignments/` | Professor, subject, section, term, nested meetings |
| Availability windows | `/api/availability-windows/` | Professor, day, time range, preferred flag |
| Busy blocks | `/api/busy-blocks/` | Professor, day, time range |

Assignment requests use nested meetings:

```json
{
  "prof": 1,
  "subject": 1,
  "section": 1,
  "meetings": [
    {"mode": "sync", "duration_slots": 2},
    {"mode": "lab"}
  ]
}
```

`term` is read-only on assignments and is derived from the section. A meeting
that omits `duration_slots` inherits the registrar-configured default for its
mode. At least one `sync` or `lab` meeting is required.

> **Known gap:** there is no `/api/admin/terms/` endpoint. Academic terms are
> currently managed through Django admin at `/admin/`.

### Authentication and user profile

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/jwt/login/` | Public | Obtain tokens |
| `POST` | `/api/auth/jwt/refresh/` | Public | Refresh access token |
| `POST` | `/api/auth/jwt/verify/` | Public | Verify token |
| `GET` | `/api/auth/jwt/me/` | Authenticated | Current user and role |
| `POST` | `/api/auth/jwt/logout/` | Authenticated | Blacklist refresh token |
| `POST` | `/api/token/` | Public | Legacy token pair |
| `POST` | `/api/token/refresh/` | Public | Legacy refresh |
| `POST` | `/api/token/verify/` | Public | Legacy verify |

### Schedule generation and runs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/schedules/generate` | Registrar | Generate and persist a schedule run |
| `GET` | `/api/schedules/runs` | Registrar | List schedule runs |
| `GET` | `/api/schedules/runs/<pk>` | Registrar | Retrieve one run |
| `GET` | `/api/schedules/runs/<pk>/classes` | Authenticated | List classes with optional filters |
| `GET` | `/api/schedules/runs/<pk>/classes/published` | Public | Classes for a published run |
| `GET` | `/api/schedules/my` | Authenticated | Latest active-term schedule for the caller |

Generation request:

```json
{
  "algorithm": "greedy",
  "time_limit_s": 30
}
```

The request always uses the active academic term. Supported algorithms are
`greedy`, `min_conflicts`, and `backtracking`. The response is `201` even when
the result is infeasible; inspect `feasible`, `violations`, and `unplaced`.

```json
{
  "run_id": 17,
  "algorithm": "greedy",
  "status": "feasible",
  "feasible": true,
  "runtime_ms": 6.69,
  "soft_score": 987.78,
  "class_count": 53,
  "violations": [],
  "unplaced": []
}
```

`/api/schedules/runs/<pk>/classes` supports `prof`, `section`, `room`, and
`day` query filters. Staff see every class in the run; professors see only
their own classes.

### Professor self-service

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/professor/me/` | Professor | Profile and active-term assignments |
| `GET` | `/api/professor/me/schedule/` | Professor | Weekly schedule from the latest active-term run |
| `GET` | `/api/professor/me/schedule/conflicts/` | Professor | Personal conflict audit |
| CRUD | `/api/professor/availability/` | Professor | Own availability windows |
| CRUD | `/api/professor/busy-blocks/` | Professor | Own busy blocks |

These endpoints force the professor profile from the authenticated account;
clients cannot create records for another professor.

### Public schedules

These endpoints require no authentication and return only published runs.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/public/schedules/` | Terms with published schedules |
| `GET` | `/api/public/schedules/<term_code>/` | Published schedule for a term |
| `GET` | `/api/public/schedules/<term_code>/sections/` | Sections in the published run |
| `GET` | `/api/public/schedules/<term_code>/sections/<section_id>/` | Schedule for one section |

Term codes use `YYYY-S`. An invalid code returns `400`; a missing term returns
`404`. When a term exists but no run is published, the response contains an
empty schedule or message.

### Registrar administration

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard/` | Legacy dashboard counts and recent-run summary |
| `GET` | `/api/admin/stats/` | Legacy aggregate statistics |
| `POST` | `/api/admin/sections/bulk/` | Bulk-create sections |
| `POST` | `/api/admin/assignments/bulk/` | Bulk-create assignments and meetings |
| `GET` | `/api/admin/schedules/runs/<pk>/conflicts/` | Dynamic conflict audit for a run |
| `PATCH` | `/api/admin/schedules/runs/<pk>/publish/` | Publish or unpublish a run |
| `GET` | `/api/admin/schedules/runs/<run_id>/conflict-resolutions/` | List conflict-resolution records |
| `POST` | `/api/admin/conflict-resolutions/<pk>/resolve/` | Resolve a conflict record |
| `POST` | `/api/admin/conflict-resolutions/<pk>/ignore/` | Ignore a conflict record |

Publish request:

```json
{"published": true}
```

Bulk assignment requests are validated per row and return a summary with
`created`, `errors`, and counts. The term defaults to the active term; a
missing meetings array defaults to one synchronous meeting.

The conflict-resolution endpoints update existing records only. Current code
does not automatically create `ConflictResolution` rows during generation or
conflict detection. This is recorded as a known gap in
[Requirements](requirements.md).

### Analytics

All analytics endpoints require the registrar role. Responses use the envelope:

```json
{
  "meta": {
    "term": {},
    "run": {},
    "selection": "latest_published",
    "pagination": {"total": 10, "limit": 50, "offset": 0}
  },
  "summary": {},
  "data": {}
}
```

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/analytics/overview/` | Combined coverage, quality, workload, room, section, and conflict summary |
| `GET` | `/api/admin/analytics/quality/` | Run history, feasibility, runtime, and soft-score comparisons |
| `GET` | `/api/admin/analytics/workload/` | Professor hours, peaks, consecutive runs, limits, and preferred hours |
| `GET` | `/api/admin/analytics/rooms/` | Room utilization, capacity fit, and weekly heatmap |
| `GET` | `/api/admin/analytics/sections/` | Section-level meeting coverage |

Selection:

- `term`: term ID or `YYYY-S`. Defaults to the active term, then to the term of
  the selected run when no active term exists.
- `run`: run ID. Defaults to the latest published run, then the latest feasible
  run, then the latest run.
- A run that does not belong to an explicitly selected term is rejected with
  `400`.

Filters:

| Endpoint | Extra parameters |
| --- | --- |
| `quality` | `algorithm`, `status`, `from`, `to` |
| `workload` | `department` |
| `rooms` | `building`, `department` |
| `sections` | `program` |

All list endpoints accept `limit` and `offset`. See
[Analytics](operations.md#analytics) for metric definitions.

### Audit, settings, and imports

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/audit/` | Registrar | Paginated audit log with filters |
| `GET` | `/api/settings/` | Registrar | List global settings |
| `PATCH` | `/api/settings/` | Registrar | Bulk-update settings |
| `GET` | `/api/settings/<key>/` | Registrar | Read one setting |
| `PATCH` | `/api/settings/<key>/` | Registrar | Update one setting |
| `POST` | `/api/imports/preview/` | Registrar | Validate an uploaded workbook |
| `POST` | `/api/imports/commit/` | Registrar | Commit a validated preview |
| `GET` | `/api/imports/template/` | Registrar | Download the XLSX template |
| `GET` | `/api/imports/template/csv/` | Registrar | Download CSV templates as a ZIP |
| `GET` | `/api/exports/schedules/<pk>.xlsx` | Registrar | Export a run as XLSX |
| `GET` | `/api/exports/schedules/<pk>.pdf` | Registrar | Export a run as PDF |

Audit filters: `action`, `model`, `user`, `from`, and `to`.

Bulk settings update:

```json
{
  "settings": [
    {"key": "sync_duration_default", "value": 2},
    {"key": "lab_duration_default", "value": 3}
  ]
}
```

The bulk endpoint returns `{"updated": [...], "errors": [...]}` with status
`200`, even when some entries fail. The single-setting endpoint returns `400`
for invalid values and preserves the existing description when one is omitted.

Import preview is `multipart/form-data` with a `file` field. A valid preview
returns `preview_token`; commit sends `{"preview_token": "<token>"}`. Preview
state is cached for **15 minutes** (900 seconds) and is process-local with the
default Django cache, so a multi-process deployment needs a shared cache.

## OpenAPI and compatibility

Generate the committed schema with:

```bash
cd backend
python manage.py spectacular --file ../docs/api/openapi.yaml
```

The schema is the detailed field-level contract. This page is the human-readable
catalog and operational guide. Keep both in sync when endpoints change.

> **Known schema-generation limitation:** `drf-spectacular` currently reports
> warnings and errors for several custom `APIView` endpoints that do not declare
> serializer response types. The generated document includes those paths, but
> some response bodies are omitted or untyped. The catalog on this page and the
> source views are authoritative until schema annotations are added.

Compatibility notes:

- `/api/token/*` is **Legacy**; use `/api/auth/jwt/*`.
- `/api/admin/dashboard/` and `/api/admin/stats/` are **Legacy**; analytics
  endpoints are preferred.
- Some custom endpoints return different error envelope shapes than DRF
  validation errors.
- There is no URL versioning. Coordinate breaking changes through the release
  process described in [CONTRIBUTING](../CONTRIBUTING.md).

## Related documentation

- [Security](security.md) — role matrix, token handling, and known gaps
- [Configuration](configuration.md) — JWT, pagination, database, and settings
- [Operations](operations.md) — import/export and analytics workflows
- [Scheduling engine](scheduling-engine.md) — generation semantics
- [OpenAPI schema](api/openapi.yaml)
