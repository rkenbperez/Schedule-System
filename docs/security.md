# Security

This page describes the implemented security controls, the authorization model,
and the gaps that must be closed before a production deployment. It is written
for maintainers, operators, and reviewers. It does not replace a formal threat
model or penetration test.

## Security objectives

- Protect catalog, assignment, availability, and schedule data from unauthorized
  changes.
- Ensure registrars can manage the institution while professors can only change
  their own availability and busy blocks.
- Prevent unauthenticated users from viewing unpublished schedules.
- Keep credentials, tokens, and personal data out of logs and source control.
- Preserve enough evidence to investigate administrative actions where the
  current audit implementation allows it.

## Assets and trust boundaries

| Asset | Sensitivity | Where it lives |
| --- | --- | --- |
| User credentials and tokens | High | Django auth tables; tokens issued by the API |
| Professor profiles and availability | Medium | `users`, `timetable` tables |
| Catalog and assignments | Medium | `catalog`, `timetable` tables |
| Schedule runs and published schedules | Medium | `timetable` tables; public endpoints for published runs |
| Global settings | Medium | `timetable_globalsettings` |
| Import files and preview tokens | Medium | Uploaded files; Django cache |
| Audit records | High (integrity) | `timetable_auditlog` |
| Secret key and database | Critical | Django settings and the SQLite file |

Trust boundaries:

1. **Client → HTTP API** — all request data is untrusted.
2. **API → database** — Django ORM parameterizes queries; custom code must not
   introduce raw SQL.
3. **API → import parser** — uploaded XLSX/CSV ZIP files are untrusted input.
4. **API → cache** — import previews are stored in the configured Django cache.
5. **Development environment → production** — current settings are
   development-oriented and must be replaced.

## Authentication

The primary authentication mechanism is JWT bearer authentication.

| Control | Implementation |
| --- | --- |
| Login | `POST /api/auth/jwt/login/` with username and password |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |
| Refresh rotation | Enabled |
| Blacklist after rotation | Enabled |
| Logout | Blacklists the supplied refresh token; returns `205` |
| Signing | HS256 using Django's `SECRET_KEY` |
| Legacy compatibility | DRF token authentication and `/api/token/*` remain enabled |

The authenticated user's role is derived as follows:

- `is_staff=True` → **registrar**
- non-staff user with a `Professors` profile → **professor**
- otherwise → **authenticated user**

Passwords are validated by Django's configured password validators. Password
reset, email verification, and multi-factor authentication are not implemented.

## Authorization

### Role matrix

| Capability | Registrar | Professor | Authenticated user | Public |
| --- | --- | --- | --- | --- |
| Read catalog and assignments | Yes | Yes | Yes | No |
| Create/update/delete catalog and assignments | Yes | No | No | No |
| Manage own availability and busy blocks | Yes (via admin) | Yes | No | No |
| Generate a schedule | Yes | No | No | No |
| List all schedule runs | Yes | No | No | No |
| View classes in a run | Yes | Own classes | Own classes where supported | No |
| View own professor schedule | Yes (staff view) | Yes | No | No |
| Publish/unpublish a run | Yes | No | No | No |
| View a published schedule | Yes | Yes | Yes | Yes |
| View analytics | Yes | No | No | No |
| Manage settings | Yes | No | No | No |
| Review audit log | Yes | No | No | No |
| Import/export data | Yes | No | No | No |
| Resolve/ignore conflict records | Yes | No | No | No |

### Permission implementation

| Permission class | Behavior |
| --- | --- |
| `IsRegistrar` | Authenticated and `is_staff=True` |
| `IsRegistrarOrReadOnly` | Authenticated read; staff-only writes |
| `IsProfessor` | Authenticated, non-staff, has a `Professors` profile |
| `IsOwnerOrRegistrar` | Object-level ownership check for professor records |
| `IsPublicReadOnly` | Safe methods allowed for everyone; unsafe methods require authentication |

Professor self-service viewsets force the `prof` field from the authenticated
user, so a professor cannot create or modify another professor's availability or
busy blocks.

## Input validation and injection

- Database access uses the Django ORM; no raw SQL or shell execution was found
  in the application code during the documentation review.
- Serializers validate field types, choices, ranges, and relational constraints.
- Model check constraints enforce positive durations and valid day/time ranges.
- The scheduling engine validates hard constraints before reporting a run as
  feasible.
- Import parsing validates workbook structure and row values before a preview
  token is issued.
- File uploads are parsed with `openpyxl` or a CSV ZIP reader. The parser accepts
  `.xlsx` files and `.zip` archives of CSVs. There is no explicit upload-size
  quota, decompression limit, or antivirus scan.

## Data protection

- Transport security is not configured in Django (`SECURE_SSL_REDIRECT`,
  HSTS, and secure cookies are absent). Production must terminate TLS at a
  reverse proxy and enable the corresponding Django security settings.
- JWT tokens and passwords are never written to application logs by the
  current code.
- The development database is SQLite (`backend/db.sqlite3`). It contains
  personal data and should be excluded from backups that are not access
  controlled.
- Import previews are stored in the default Django cache for 900 seconds. The
  default local-memory cache is process-local; multi-process deployments need a
  shared, access-controlled cache.
- Audit records are readable only by registrars, but the application does not
  currently create them automatically.

## Threat model

| Threat | Impact | Current control | Residual risk |
| --- | --- | --- | --- |
| Stolen access token | Unauthorized actions until expiry | 1-hour access lifetime; refresh rotation | Token storage and revocation are client responsibilities |
| Stolen refresh token | Long-lived access | 7-day lifetime; logout blacklists | No device/session inventory |
| Brute-force login | Account compromise | Throttle class exists but is not attached | **High** until rate limiting is enabled |
| Privilege escalation | Unauthorized registrar actions | Staff check in `IsRegistrar` | Staff accounts must be tightly controlled |
| Professor modifies another professor | Data tampering | Forced ownership filtering | None identified in current viewsets |
| Catalog data exposure | Privacy/business impact | Authentication required for reads | All authenticated users can read the catalog |
| Unpublished schedule exposure | Information leak | Published-only public querysets | Authenticated users can read runs where permitted |
| Malicious upload | DoS or parser exploit | Format checks and validation | No upload/decompression quota |
| Secret leakage | Full compromise | None beyond repository access | **High** — secret is hardcoded |
| Repudiation | No accountability | AuditLog model and read API | **High** — no automatic audit writes |

## Known gaps

The following are confirmed limitations in the current codebase:

1. **Hardcoded `SECRET_KEY`** in `backend/core/settings.py`. The JWT signing key
   uses the same value. Move it to an environment variable and rotate it before
   production.
2. **`DEBUG=True`** and a restricted development `ALLOWED_HOSTS`. Production
   settings are not provided.
3. **SQLite** is the only configured database. Use a production database with
   backups and access control for deployments.
4. **Login throttling is not active.** `LoginRateThrottle` is defined but not
   attached to `JWTLoginView`, despite the `10/min` rate configured in
   `DEFAULT_THROTTLE_RATES`.
5. **Audit logging is not automatic.** `AuditLog` rows are not created by the
   catalog, assignment, generation, publish, or import code paths.
6. **Conflict-resolution records are not automatic.** Generation and conflict
   audits do not create `ConflictResolution` rows; the API can only update
   records that already exist.
7. **No CORS configuration.** The planned React frontend will need an explicit
   allowed-origin policy.
8. **No production transport or cookie hardening.** Add TLS, HSTS, secure
   cookies, and trusted-origin settings at deployment time.
9. **Demo credentials are fixed.** `demoreg` / `demo12345` is development-only.
   The `--allow-non-debug` override can create fixed-password accounts on a
   deployed server and must not be used in production.
10. **No upload quotas.** Add request-size limits and decompression limits at
    the reverse proxy or application layer.

## Production checklist

- [ ] Move `SECRET_KEY`, database credentials, and allowed hosts to environment
      variables.
- [ ] Set `DEBUG=False`.
- [ ] Enable TLS and HSTS at the reverse proxy.
- [ ] Set secure and HTTP-only cookie flags where cookies are used.
- [ ] Configure `ALLOWED_HOSTS`, trusted origins, and CORS for the frontend.
- [ ] Attach and test login throttling.
- [ ] Add application-level audit writes for sensitive operations.
- [ ] Replace SQLite with a production database and configure backups.
- [ ] Add upload size and decompression limits.
- [ ] Restrict access to `/admin/` and use strong staff passwords.
- [ ] Configure centralized logging and monitoring.
- [ ] Run dependency and container vulnerability scans.

## Reporting a vulnerability

Do not open a public issue containing exploit details or real credentials.
Use GitHub's private vulnerability reporting if it is enabled for the
repository; otherwise contact the repository maintainers privately and include
the affected endpoint, reproduction steps, and impact.

## Related documentation

- [API reference](api-reference.md) — authentication endpoints and errors
- [Configuration](configuration.md) — settings and deployment values
- [Deployment](deployment.md) — production topology and hardening
- [Requirements](requirements.md) — security-related non-functional requirements
