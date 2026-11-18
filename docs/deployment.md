# Deployment

This page covers the current development deployment and a recommended production
topology. The repository currently contains a Django backend only; the React
frontend has not been scaffolded. The production topology below is guidance for
future deployment, not an implemented configuration.

## Current development deployment

```mermaid
flowchart LR
    Dev[Developer browser] -->|HTTP :8000| Django[Django development server]
    Django --> DB[(SQLite<br/>backend/db.sqlite3)]
    Django --> Schema[Swagger UI / ReDoc]
    Admin[Registrar browser] -->|/admin/| Django
    Public[Public browser] -->|published schedules| Django
```

### Prerequisites

- Python 3.14 (as documented by the backend README)
- `pip` and `venv`
- A POSIX-like shell; the documented commands use macOS/Linux paths

### Local setup

See [Backend README: First-time setup](../backend/README.md#first-time-setup)
for local installation and account creation. The API is available at
`http://127.0.0.1:8000/api/`; Swagger UI and ReDoc are under
`/api/schema/swagger-ui/` and `/api/schema/redoc/`.

For demo data, see [Operations: Demo environment](operations.md#demo-environment).
For tests and checks, see [Testing](testing.md).

### Schema generation

```bash
cd backend
python manage.py spectacular --file ../docs/api/openapi.yaml
```

Commit the regenerated `docs/api/openapi.yaml` whenever endpoint contracts
change.

## Recommended production topology

> **Status: Planned.** None of the production components below are configured in
> the repository. The current `settings.py` is development-oriented.

```mermaid
flowchart LR
    Browser[Registrar / professor / public browser] -->|HTTPS| Proxy[Reverse proxy<br/>TLS, rate limits, upload limits]
    Proxy -->|HTTP| App[Gunicorn<br/>Django WSGI]
    App --> DB[(PostgreSQL)]
    App --> Cache[(Redis cache)]
    App --> Static[Static files<br/>served by proxy]
    App --> Logs[Centralized logs]
    App --> Monitor[Monitoring / alerts]
    Admin[Registrar] -->|HTTPS /admin/| Proxy
```

Recommended components:

| Concern | Recommendation |
| --- | --- |
| Application server | Gunicorn or uWSGI behind a reverse proxy; do not use `runserver` |
| Reverse proxy | Nginx, Caddy, or a managed load balancer with TLS |
| Database | PostgreSQL with automated backups and least-privilege credentials |
| Cache | Redis for import previews and future shared caching |
| Static files | `collectstatic` to a proxy-served directory or object storage |
| Secrets | Secret manager or environment variables; never commit them |
| Rate limiting | Proxy-level limits now; attach the application login throttle before launch |
| Uploads | Request-size and decompression limits at the proxy |
| Observability | Structured logs, health checks, error tracking, and database metrics |
| Backups | Encrypted database backups with restore testing |
| Access | Restrict `/admin/` by network or identity-aware proxy where possible |

### Database and backups (planned)

- Use PostgreSQL with a least-privilege application role; keep owner and backup
  roles separate.
- Take nightly logical backups with `pg_dump` (custom format), compress and
  encrypt them, and copy them offsite.
- Retain 7 daily, 4 weekly, and 3 monthly backups; verify each dump with
  `pg_restore --list`.
- Record a checksum and row-count manifest for each backup.
- Run a restore drill at least monthly. Target RPO ≤ 24 hours and RTO ≤ 1 hour
  until continuous WAL archiving or managed PITR is added.
- Do not use the SQLite development file as a production backup.

## Production settings checklist

Before deployment:

- [ ] Set `DEBUG=False`.
- [ ] Move `SECRET_KEY` to an environment variable and rotate it.
- [ ] Set `ALLOWED_HOSTS` and trusted origins for the real hostnames.
- [ ] Configure TLS and redirect HTTP to HTTPS.
- [ ] Enable HSTS, secure cookies, and CSRF trusted origins as applicable.
- [ ] Attach the login throttle class or enforce login rate limits at the proxy.
- [ ] Move to PostgreSQL with a least-privilege application role.
- [ ] Configure a shared cache for import previews.
- [ ] Configure `STATIC_ROOT` and run `collectstatic`.
- [ ] Add CORS rules for the frontend origin.
- [ ] Add upload-size and decompression limits.
- [ ] Add application-level audit writes for sensitive operations.
- [ ] Configure encrypted, offsite backups and test a restore.
- [ ] Restrict `/admin/` by network or identity-aware proxy and use strong staff passwords.
- [ ] Configure centralized logging, metrics, and alerting.
- [ ] Run dependency and container vulnerability scans.
- [ ] Verify `/api/schema/swagger-ui/` exposure is acceptable for the environment.
- [ ] Run `python manage.py check --deploy` and resolve the findings.

## Release and migration procedure

The repository uses Git tags and GitHub releases; see
[CONTRIBUTING.md](../CONTRIBUTING.md).

Recommended release flow:

1. Merge the release PR into `staging`.
2. Run `python manage.py check`, `makemigrations --check --dry-run`, and the
   test suite.
3. Regenerate `docs/api/openapi.yaml` if API contracts changed.
4. Back up the database.
5. Deploy the new code and run `python manage.py migrate --noinput`.
6. Run `python manage.py collectstatic --noinput` if static settings are used.
7. Restart the application workers.
8. Smoke-test login, schedule generation, analytics, import/export, and public
   schedules.
9. Tag the release and publish release notes.

## Rollback

- Keep the previous application artifact available.
- Database migrations are not automatically reversible in every case; verify the
  reverse migration before release.
- If a release must be rolled back, restore the database from the pre-release
  backup when schema changes are incompatible.
- Revoke or rotate secrets if a rollback is caused by credential exposure.

## Current deployment limitations

- No Dockerfile, container image, or infrastructure-as-code configuration.
- No CI/CD workflow.
- No production database, cache, or static-file configuration.
- No frontend build or hosting configuration.
- No centralized logging, metrics, or alerting.
- No automated backup or restore process.

These are documented as gaps rather than implied capabilities.

## Related documentation

- [Configuration](configuration.md) — settings and environment variables
- [Security](security.md) — threat model and code-level gaps
- [Testing](testing.md) — test commands and current status
- [Operations](operations.md) — demo, imports, exports, and troubleshooting
