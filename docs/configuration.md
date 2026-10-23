# Configuration

This page describes how the backend is configured today, which values are safe
to change, and what must change before a production deployment. The authoritative
file is [`backend/core/settings.py`](../backend/core/settings.py).

## Configuration sources

| Source | Purpose | Current state |
| --- | --- | --- |
| `backend/core/settings.py` | Django, DRF, JWT, database, schema, and cache settings | Single development-oriented file |
| Environment variables | Intended deployment configuration | Not implemented |
| `GlobalSettings` database table | Runtime registrar-editable settings | Implemented |
| Django admin | Terms, users, professor profiles, and other model records | Implemented |
| Management commands | Demo data and schema generation | Implemented |

There is no `local_settings.py` import, `.env` loader, or separate
`production.py`. Any environment-specific value must currently be edited in
`settings.py` or supplied by a deployment wrapper. This is a known gap.

## Django settings

### Core

| Setting | Current value | Notes |
| --- | --- | --- |
| `DEBUG` | `True` | Development only; must be `False` in production |
| `SECRET_KEY` | Hardcoded | Move to a secret manager or environment variable |
| `ALLOWED_HOSTS` | `testserver`, `localhost`, `127.0.0.1` | Add the deployed hostname before production |
| `TIME_ZONE` | `UTC` | API timestamps are UTC |
| `USE_TZ` | Django default (`True`) | Timezone-aware datetimes |
| `DEFAULT_AUTO_FIELD` | `BigAutoField` | Integer primary keys |
| `ROOT_URLCONF` | `core.urls` | API mounted under `/api/` |
| `WSGI_APPLICATION` | `core.wsgi.application` | Standard WSGI entry point |

### Installed applications

Django contrib apps, DRF, token authentication, SimpleJWT and its blacklist app,
drf-spectacular, and the local apps:

```text
users
catalog
timetable
data_transfer
```

The top-level `exports/` directory is not an installed app; export code lives in
`backend/data_transfer/export_utils.py`.

### Database

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
```

SQLite is suitable for local development and the demo. Production should use a
server database with backups, connection pooling, and restricted network access.
`backend/db.sqlite3` is ignored by Git.

### Static files and templates

- `STATIC_URL` uses Django's default static handling.
- No `STATIC_ROOT` or `collectstatic` workflow is configured.
- Templates use app directories; there is no project-level template directory.
- The Django admin is available at `/admin/`.

## REST framework

| Setting | Value |
| --- | --- |
| Default permission | `IsAuthenticated` |
| Authentication | JWT first, then DRF token authentication |
| Pagination | Page-number pagination, 20 records per page |
| Schema class | `drf_spectacular.openapi.AutoSchema` |
| Login throttle rate | `login: 10/min` configured, but not attached to the login view |

Public schedule endpoints override the default permission with
`IsPublicReadOnly`. Analytics endpoints use their own `limit`/`offset`
pagination.

## JWT settings

| Setting | Value |
| --- | --- |
| Access lifetime | 1 hour |
| Refresh lifetime | 7 days |
| Rotate refresh tokens | Yes |
| Blacklist after rotation | Yes |
| Algorithm | HS256 |
| Signing key | Django `SECRET_KEY` |
| Authorization header | `Bearer <token>` |
| ID claim | `user_id` |

Logout requires the refresh token and blacklists it. Because the signing key is
the Django secret, rotating the secret invalidates all outstanding tokens.

## OpenAPI and interactive documentation

`drf-spectacular` serves:

- Schema: `/api/schema/`
- Swagger UI: `/api/schema/swagger-ui/`
- ReDoc: `/api/schema/redoc/`

Generate the committed schema with:

```bash
cd backend
python manage.py spectacular --file ../docs/api/openapi.yaml
```

The schema title is `Schedule API`; its internal schema version is `1.0.0`.
The project does not use URL-based API versioning.

## Runtime settings (`GlobalSettings`)

Registrars can edit selected runtime values through `/api/settings/` or Django
admin. The seeded keys are:

| Key | Default | Type | Purpose |
| --- | --- | --- | --- |
| `async_duration_default` | `1` | Positive integer (hours) | Default length for asynchronous meetings |
| `sync_duration_default` | `2` | Positive integer (hours) | Default length for synchronous meetings |
| `lab_duration_default` | `3` | Positive integer (hours) | Default length for laboratory meetings |

Behavior:

- Values are validated as positive, non-boolean integers by the settings API.
- Defaults apply only when a meeting is created **without** `duration_slots`.
- Existing meetings are never rewritten when a default changes.
- The demo command seeds meetings from the current defaults.
- If a key is missing, the code falls back to the built-in
  `MODE_DURATIONS` values (`async=1`, `sync=2`, `lab=3`).

```bash
curl -X PATCH http://127.0.0.1:8000/api/settings/ \
  -H "Authorization: Bearer <registrar-token>" \
  -H "Content-Type: application/json" \
  -d '{"settings": [
    {"key": "sync_duration_default", "value": 2},
    {"key": "lab_duration_default", "value": 3}
  ]}'
```

Bulk updates return `{"updated": [...], "errors": [...]}` even when individual
entries fail. The single-setting endpoint returns `400` for invalid values.

## Cache

No `CACHES` setting is defined, so Django uses its default local-memory cache.
Consequences:

- Import previews are stored for 900 seconds per process.
- A multi-process or multi-instance deployment will lose previews when a
  request reaches another worker.
- Configure Redis or another shared cache before horizontal scaling.

## Demo configuration

The demo command is development-only by default:

```bash
cd backend
python manage.py demo_schedule --reset
```

It uses a fixed demo registrar (`demoreg` / `demo12345`) and generates three
schedule runs. The `--allow-non-debug` flag bypasses the development guard and
can create fixed-password accounts on a deployed server. Do not use it in
production.

## Recommended environment variables

The current code does not read these variables, but a production deployment
should introduce them and load them in `settings.py`:

```text
DJANGO_SECRET_KEY
DJANGO_DEBUG
DJANGO_ALLOWED_HOSTS
DATABASE_URL
CACHE_URL
JWT_ACCESS_LIFETIME
JWT_REFRESH_LIFETIME
CORS_ALLOWED_ORIGINS
```

Validate the resulting configuration with:

```bash
cd backend
python manage.py check --deploy
```

The current development settings will emit deployment warnings; treat them as a
required remediation list, not as documentation errors.

## Related documentation

- [Security](security.md) — production security gaps and checklist
- [Deployment](deployment.md) — local and recommended production topology
- [API reference](api-reference.md) — settings and authentication endpoints
- [Operations](operations.md) — demo and settings workflows
