# Architecture

## Architectural style

Schedule Maker is a layered Django REST application with a pure-Python
scheduling core. The web layer handles authentication, validation, persistence,
and HTTP contracts; the engine receives an in-memory scenario and returns placed
classes and violations. There is no message broker, background worker, or
separate service in the current implementation.

```mermaid
flowchart LR
    Registrar([Registrar])
    Professor([Professor])
    Public([Public user])
    Admin([Django administrator])

    subgraph Scheduler["Schedule Maker"]
        API["Django REST API"]
        DjangoAdmin["Django admin"]
        Engine["Pure-Python scheduling engine"]
        DB[("Database<br/>SQLite dev / PostgreSQL planned")]
        Schema["OpenAPI / Swagger / ReDoc"]
    end

    Registrar -->|"catalog, assignments, generation, analytics"| API
    Professor -->|"availability, own schedule"| API
    Public -->|"published schedules"| API
    Admin -->|"users, terms, profiles"| DjangoAdmin
    API --> Engine
    API --> DB
    DjangoAdmin --> DB
    API --> Schema
```

## C4 Level 1 — System context

```mermaid
flowchart TB
    Registrar["Registrar\n(staff user)"]
    Professor["Professor\n(non-staff user)"]
    Public["Public user\n(anonymous)"]
    Admin["Django administrator\n(staff user)"]

    System["Schedule Maker\nDjango REST API + scheduling engine"]

    Registrar -->|"catalog and assignment data; generation requests; settings"| System
    System -->|"schedules, conflicts, analytics, exports"| Registrar
    Professor -->|"availability, busy blocks"| System
    System -->|"own schedule and personal conflicts"| Professor
    Public -->|"term and section queries"| System
    System -->|"published timetable"| Public
    Admin -->|"user, professor, and term administration"| System
```

The system has no external payment, email, LMS, or calendar integration. All
data is stored locally in the configured database.

## C4 Level 2 — Containers

```mermaid
flowchart TB
    Browser["API client / browser"]
    Swagger["Swagger UI / ReDoc\n(drf-spectacular)"]
    AdminUI["Django admin"]
    API["Django REST API\n(core, users, catalog, timetable, data_transfer)"]
    Scheduler["Scheduling engine\n(pure Python)"]
    DB[("Database\nSQLite dev / PostgreSQL planned")]

    Browser -->|"HTTPS/HTTP JSON + JWT"| API
    Swagger -->|"reads schema"| API
    AdminUI -->|"staff session"| API
    API -->|"scenario input"| Scheduler
    Scheduler -->|"classes, violations, score"| API
    API -->|"Django ORM"| DB
    AdminUI -->|"Django ORM"| DB
```

The planned React frontend is not part of the current container set. When it is
added, it should be an additional browser client that consumes the same API.

## C4 Level 3 — Components

```mermaid
flowchart TB
    subgraph APIApp["Django project: core"]
        URLs["URL routing\ncore/urls.py + app urls"]
        Settings["Settings\ncore/settings.py"]
    end

    subgraph Users["users"]
        Auth["JWT login, refresh, logout, me"]
        ProfView["Professor viewset"]
        ProfModel["Professors profile"]
    end

    subgraph Catalog["catalog"]
        CatViews["Department, room, subject, section viewsets"]
        CatModels["Catalog models"]
    end

    subgraph Timetable["timetable"]
        TTViews["Schedule, admin, professor, public views"]
        TTSerializers["Serializers and validation"]
        TTModels["Assignments, meetings, availability, runs, classes, settings, audit"]
        Scenario["scenario_builder"]
        Engines["engines: greedy, min_conflicts, backtracking, scoring, constraints"]
        Analytics["analytics: filters, metrics, conflict auditor, views"]
    end

    subgraph Transfer["data_transfer"]
        Import["XLSX/CSV import preview and commit"]
        Export["XLSX/PDF export"]
    end

    URLs --> Users
    URLs --> Catalog
    URLs --> Timetable
    URLs --> Transfer
    TTViews --> TTSerializers
    TTSerializers --> TTModels
    TTViews --> Scenario
    Scenario --> Engines
    Analytics --> TTModels
    Analytics --> Engines
    Import --> CatModels
    Import --> TTModels
    Export --> TTModels
```

### Application responsibilities

| App | Responsibility |
| --- | --- |
| `core` | Project settings, root URL routing, WSGI entry point |
| `users` | Authentication endpoints, professor profile model, professor viewset |
| `catalog` | Departments, rooms, subjects, sections and their serializers/viewsets |
| `timetable` | Assignments, meeting slots, availability, busy blocks, schedule runs, scheduled classes, settings, audit log, conflict resolutions, analytics, and the scheduling engine |
| `data_transfer` | Spreadsheet/CSV templates, import preview/commit, and XLSX/PDF schedule export |

### Key internal boundaries

- **HTTP layer** — DRF views and serializers validate input and enforce
  permissions.
- **Domain layer** — Django models encode uniqueness, choices, and check
  constraints.
- **Adapter layer** — `timetable/scenario_builder.py` is the only bridge from
  database models to the engine.
- **Engine layer** — `timetable/engines/` is pure Python and has no Django
  imports, so it can be unit-tested and reused independently.
- **Analytics layer** — `timetable/analytics/` uses Django ORM queries and the
  shared conflict auditor; it does not mutate schedule data.

## Request lifecycle

A typical protected request follows this path:

1. The client sends a JWT access token in the `Authorization` header.
2. DRF authenticates the user and applies the endpoint's permission class.
3. The view parses query parameters or a serializer validates the body.
4. The view reads or writes models through the Django ORM.
5. For generation, the scenario builder converts the active term to engine
   input, the engine runs, and the transaction persists the run and classes.
6. The response is serialized to JSON.

Analytics requests follow a similar path but only read data:
`resolve_context()` selects the term/run, metric builders query assignments,
classes, rooms, and availability, and the conflict auditor computes violations
on demand.

## Technology and deployment assumptions

| Concern | Current choice |
| --- | --- |
| Language/runtime | Python 3.14 |
| Web framework | Django 5.2 and Django REST Framework 3.15 |
| Authentication | simplejwt (JWT access/refresh, rotation, blacklist) |
| API schema | drf-spectacular with Swagger UI and ReDoc |
| Database | SQLite for development; PostgreSQL planned for production |
| Scheduling | Pure Python, synchronous request |
| Frontend | Planned React + Vite, not scaffolded |
| Async processing | None; generation blocks the request |

## Architecture decisions and trade-offs

- **Pure engine:** keeps algorithm code testable and portable, at the cost of an
  explicit adapter layer.
- **Synchronous generation:** simple to deploy and debug, but unsuitable for
  very large datasets or multi-minute runs without a background worker.
- **SQLite development database:** zero setup; PostgreSQL is the planned
  production database for concurrency, backups, and access control.
- **Dynamic conflict calculation:** analytics always reflect current data and do
  not depend on a conflict-resolution table that current operations do not
  populate. The cost is repeated computation.
- **Global settings table:** allows runtime configuration without a deployment;
  invalid values are validated at the API boundary.

## Known architectural gaps

The main architectural constraints are synchronous generation (no background
worker), the absence of a production settings split, and the missing
audit/conflict-resolution writes. See [Deployment: Current deployment
limitations](deployment.md#current-deployment-limitations) and [Security: Known
gaps](security.md#known-gaps) for the authoritative lists.

See [Data flow](data-flow.md) for process-level views and
[Deployment](deployment.md) for operational guidance.
