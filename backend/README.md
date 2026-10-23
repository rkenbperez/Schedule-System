# Schedule Maker — Backend

A REST API that turns a professor's inputs — the subjects and sections they
teach, plus the times they are available — into a weekly timetable that spreads
classes across Monday to Saturday, scoped to academic terms (First/Second
Semester).

This is the backend service. It stores the data, checks the rules, and runs the
scheduling logic. A web frontend will talk to this API in a later phase.

---

## How it works

1. A **registrar** enters the building blocks: departments, subjects, sections
   (class groups), rooms, and the professors who teach them.
2. Each professor has an **assignment** (what they teach and to which section)
   made of one or more weekly **meetings**, plus **availability windows** (when
   they can teach) and optional **busy blocks** (times they are already
   occupied).
3. The registrar asks the system to **generate a schedule** for an active
   academic term. The scheduler places every class into a time slot and a room
   while respecting the rules.
4. The result is saved so it can be viewed or compared later.

### Academic Terms

Schedules are scoped to academic terms — **First Semester** and **Second
Semester** (e.g., "2024-1", "2024-2"). Each term has start/end dates and an
`is_active` flag. The registrar activates one term at a time; all scheduling
operations use the active term by default.

### Departments

Every room and every professor can belong to a **department** (e.g. "CS",
"IT", "Math"). The list of departments is managed by the registrar. A professor
is only scheduled into rooms of their own department; a room with no department
is a general/shared room any professor may use, and a professor with no
department may teach anywhere.

### Meeting modes

Every weekly meeting of an assignment has a **mode** that suggests how long it
runs:

| Mode        | Default length |
| ----------- | -------------- |
| `async`     | 1 hour         |
| `sync`      | 2 hours        |
| `lab`       | 3 hours        |

The registrar can change these global defaults with the
`async_duration_default`, `sync_duration_default`, and `lab_duration_default`
settings (values are positive integers measured in hours). The defaults apply
whenever a meeting omits `duration_slots`; existing meetings are not changed.

A professor's load can mix modes — for example one assignment may have a
synchronous 2-hour lecture on Monday and an asynchronous 1-hour session on
Wednesday. The registrar can also override the default length of any meeting
with `duration_slots`. The chosen mode and length are saved with each scheduled
class so the output shows whether a class is asynchronous, synchronous, or a
laboratory session.

Every assignment must contain at least one synchronous (`sync` or `lab`)
meeting — a weekly load that is entirely asynchronous is rejected.

### The three algorithms

The scheduler can search for a schedule in three different ways. This is the
research focus of the project: comparing how each one behaves.

| Algorithm     | Idea (in plain words)                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| `greedy`      | Fill the hardest classes first, place each in the first free slot that works, never undo a choice. Fast, but can get stuck. |
| `min_conflicts` | Start with a rough draft (even if it breaks rules), then repeatedly move the worst class until the clashes disappear. Good at improving a draft. |
| `backtracking`  | Try a choice; if it leads to a dead end, step back and try another. Guarantees an answer if one exists, but can be slower. |

For the same input, each algorithm reports how long it took (`runtime_ms`) and
how good the result is (`soft_score`, lower is better), which makes them
directly comparable for evaluation.

---

## Roles

The API has three kinds of users.

| Role        | Who it is                     | What they can do                                              |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| Registrar   | The administrator (`is_staff`) | Create subjects, sections, rooms, professors, and assignments; generate schedules; see everything. |
| Professor   | A teacher                     | Set their own availability and busy blocks; view only their own schedule. |
| Public      | No account required           | View published schedules for any term (read-only). |

> A professor cannot log into the Django admin site (`/admin/`). Only a
> registrar (staff) account can. Professors use the API (or the future
> frontend) instead.

---

## Project layout

```
backend/
├── core/          Project settings and URL routing
├── catalog/       Departments, subjects, sections, and rooms
├── timetable/     Assignments, availability, schedules, and the algorithm engine
├── users/         Login and professor profiles
└── manage.py      Django's command-line entry point
```

The scheduling engine lives in `timetable/engines/` and is **pure Python** — it
has no Django imports, so the algorithms can be read and tested on their own.
The only file that connects the engine to the database is
`timetable/scenario_builder.py`.

---

## Getting started

You need Python 3.14 and a way to create a virtual environment.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API is now running at `http://127.0.0.1:8000/api/`.

Interactive API documentation is generated automatically:

- Swagger UI: `http://127.0.0.1:8000/api/schema/swagger-ui/`
- ReDoc: `http://127.0.0.1:8000/api/schema/redoc/`

---

## Creating accounts

**Registrar (administrator):**

```bash
python manage.py createsuperuser
```

Follow the prompts to set a username and password. This account can log into
`/admin/` and use every API endpoint.

**Professor:**

Create the account through the Django admin site:

1. Log into `/admin/` as the registrar.
2. Create the departments first (**Departments → Add department**), e.g. "CS".
4. Go to **Users → Add user**.
5. Set a username and password, and fill in the professor's details
   (department chosen from the list, daily limits) in the **Professors** section
   on the same form.

Rooms can be given a department in the same way (**Rooms → Add room**). Leave it
blank for a shared/general room.

---

## Using the API

### Authentication (JWT)

The API uses JWT authentication via `djangorestframework-simplejwt`. Every
request (except login) needs a JWT access token in the `Authorization` header:

```
Authorization: Bearer <your-access-token>
```

### 1. Log in to get tokens

```bash
curl -X POST http://127.0.0.1:8000/api/auth/jwt/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

The response contains an `access` token and a `refresh` token. Use the access
token in the following steps. The refresh token can be used to obtain a new
access token:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/jwt/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<your-refresh-token>"}'
```

Get current user profile + role:

```bash
curl http://127.0.0.1:8000/api/auth/jwt/me/ \
  -H "Authorization: Bearer <your-access-token>"
```

Logout (blacklist refresh token):

```bash
curl -X POST http://127.0.0.1:8000/api/auth/jwt/logout/ \
  -H "Authorization: Bearer <your-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<your-refresh-token>"}'
```

Legacy simplejwt endpoints (`/api/token/`, `/api/token/refresh/`,
`/api/token/verify/`) are also available for backward compatibility.

### 2. Add data (Registrar only)

```bash
# Create a department and keep its id (from the response) for the next step
curl -X POST http://127.0.0.1:8000/api/departments/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "CS"}'

# The response body contains the new department's "id" (e.g. {"id": 5, "name": "CS"}).
# Use that value (not a hard-coded 1) as the room's "department":
curl -X POST http://127.0.0.1:8000/api/rooms/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "R101", "capacity": 40, "department": 5}'

# Create an academic term (First/Second Semester)
curl -X POST http://127.0.0.1:8000/api/admin/terms/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"year": 2024, "semester": 1, "start_date": "2024-08-01", "end_date": "2024-12-20", "is_active": true}'

# An assignment links a professor, subject, and section to one or more weekly
# meetings. Each meeting has a mode; length defaults from the mode (async 1h,
# sync 2h, lab 3h unless the registrar changes the defaults) but can be
# overridden per meeting with "duration_slots":
curl -X POST http://127.0.0.1:8000/api/assignments/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prof": 1, "subject": 1, "section": 1, "meetings": [{"mode": "sync"}, {"mode": "async"}]}'
```

Similar endpoints exist for `subjects`, `sections`, `profs`,
`availability-windows`, and `busy-blocks`. Room and professor responses also
include a `department_name` for convenience.

### 3. Generate a schedule (Registrar)

```bash
curl -X POST http://127.0.0.1:8000/api/schedules/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "greedy"}'
```

The response reports whether a valid schedule was found (`feasible`), how many
classes were placed, the time it took, and a quality score.

### 4. View the schedule

```bash
# All classes in a run (Registrar)
curl http://127.0.0.1:8000/api/schedules/runs/1/classes \
  -H "Authorization: Bearer <token>"

# Professor's own schedule
curl http://127.0.0.1:8000/api/schedules/my \
  -H "Authorization: Bearer <token>"

# Public: Published schedule for a term (no auth required)
curl http://127.0.0.1:8000/api/public/schedules/2024-1/

# Public: Section schedule for a term (no auth required)
curl http://127.0.0.1:8000/api/public/schedules/2024-1/sections/1/
```

See the Swagger UI for the complete list of endpoints and their fields.

---

## Advanced Features

### Analytics (Registrar)

Registrar-only operational analytics are available under
`/api/admin/analytics/`. Every endpoint returns
`{"meta": {...}, "summary": {...}, "data": {...}}`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/admin/analytics/overview/` | Combined coverage, quality, workload, room, section, and conflict summary |
| `GET /api/admin/analytics/quality/` | Schedule-run history, runtime, feasibility, and soft-score quality |
| `GET /api/admin/analytics/workload/` | Professor teaching hours, daily peaks, consecutive hours, and limits |
| `GET /api/admin/analytics/rooms/` | Room utilization, capacity fit, and a weekly occupancy heatmap |
| `GET /api/admin/analytics/sections/` | Section-level meeting coverage |

Selection and filters:

- `term` — term ID or `YYYY-S` code. Defaults to the active term.
- `run` — schedule run ID. Defaults to the latest published run, then the
  latest feasible run, then the latest run.
- `department`, `program`, `building` — catalog filters where applicable.
- `algorithm`, `status`, `from`, `to` — run-quality filters.
- `limit` and `offset` — list pagination (`limit` 1-200, default 50).

```bash
# Overview for the current active term and its latest published run
curl http://127.0.0.1:8000/api/admin/analytics/overview/ \
  -H "Authorization: Bearer <token>"

# Workload for one term
curl "http://127.0.0.1:8000/api/admin/analytics/workload/?term=2024-1" \
  -H "Authorization: Bearer <token>"
```

The older `/api/admin/stats/` and `/api/admin/dashboard/` endpoints remain for
compatibility. New integrations should use the analytics endpoints.

### Audit Log
View audit trail of all important actions:
```bash
curl http://127.0.0.1:8000/api/audit/ \
  -H "Authorization: Bearer <token>"
```
Supports filters: `?action=create&model=Assignment&from=2024-01-01&to=2024-12-31`

### Global Settings
Manage global system settings:
```bash
# Get all settings
curl http://127.0.0.1:8000/api/settings/ \
  -H "Authorization: Bearer <token>"

# Bulk update (meeting duration defaults are positive integers, in hours)
curl -X PATCH http://127.0.0.1:8000/api/settings/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"settings": [
    {"key": "async_duration_default", "value": 1},
    {"key": "sync_duration_default", "value": 2},
    {"key": "lab_duration_default", "value": 3}
  ]}'

# Get/update single setting
curl http://127.0.0.1:8000/api/settings/sync_duration_default/ \
  -H "Authorization: Bearer <token>"
```
The duration defaults only affect meetings created without an explicit
`duration_slots`; existing meetings are unchanged.

### Conflict Resolution
Track and resolve schedule conflicts:
```bash
# List conflicts for a run
curl http://127.0.0.1:8000/api/admin/schedules/runs/1/conflict-resolutions/ \
  -H "Authorization: Bearer <token>"

# Resolve a conflict
curl -X POST http://127.0.0.1:8000/api/admin/conflict-resolutions/1/resolve/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"resolution_type": "move_class", "resolution_details": {"new_room": 5, "new_time": "09:00"}}'
```

---

## Running the demo

A demo command seeds a realistic example dataset and runs the whole flow against
your running server.

Open two terminals:

```bash
# terminal 1
python manage.py runserver
```

```bash
# terminal 2
python manage.py demo_schedule
```

It creates a dev-only demo registrar (`demoreg` / password `demo12345`) plus
professors across the CS, IT, MATH and GE departments, and seeds subjects
(including GE minors such as PE and NSTP), sections, rooms, assignments and
availability. It then generates a schedule with all three algorithms and prints:

- a comparison table (`feasible`, `runtime_ms`, `soft_score`, class count)
- a readable Monday–Saturday grid of the best result

Two dataset sizes are available:

| `--scale` | Professors | Assignments | Weekly meetings | Sections |
| --------- | ---------- | ----------- | --------------- | -------- |
| `normal` (default) | 7 | 35 | 53 | 10 |
| `large` | 11 | 52 | 79 | 14 |

```bash
# Use the larger dataset (more sections and GE minors)
python manage.py demo_schedule --scale large
```

Add `--reset` to delete existing demo schedules, assignments and availability
before re-running:

```bash
python manage.py demo_schedule --reset
```

> By default, the command only runs in development. The `--allow-non-debug`
> override can create fixed-password demo accounts on a deployed server; never
> use this override in production.

---

## Running the tests

```bash
python manage.py test
```

The test suite checks, in plain terms:

- **Data rules** — invalid values (zero meeting length, a time range that ends
  before it starts, an unknown day) are rejected, and every subject load must
  include at least one synchronous (`sync` or `lab`) class per week.
- **The algorithms** — each engine produces a valid schedule, and a tricky
  example shows where `backtracking` succeeds and `greedy` fails.
- **Departments** — a professor is only placed into rooms of their own
  department; unassigned rooms/professors stay flexible.
- **Meeting modes** — each meeting carries its mode and length through to the
  scheduled classes, and durations default from the chosen mode.
- **Security** — only the registrar can generate schedules or change catalog
  data; professors can only manage their own availability.
- **End to end** — one test runs the full journey over HTTP: login, create
  data, generate, and read the schedule back.
- **Academic terms** — schedules scoped to active term, term-based filtering.
- **Edge cases** — single room, one professor, overlapping terms, mid-term
  changes, boundary conditions.
- **Scalability** — load tests up to 1000 sections.

---

## Common problems

- **`401 Authorization header must contain two space-delimited values`** — you
  likely wrote the token without the prefix. The header must be
  `Authorization: Bearer <token>`, with the word `Bearer` and a space before the
  value.
- **`401 Invalid or expired refresh token`** — the refresh token has expired or
  was already used (rotation enabled). Log in again.
- **`429 Too Many Requests` on login** — login is limited to 10 attempts per
  minute. Wait a minute and try again.
- **Professor can't log into `/admin/`** — that is expected. Only staff
  (registrar) accounts can use the admin site. Professors log in through the
  API.

---

## Quick reference: Key endpoints

| Category | Endpoint | Auth | Description |
| -------- | -------- | ---- | ----------- |
| **Auth** | `POST /api/auth/jwt/login/` | Public | Obtain JWT tokens |
| | `POST /api/auth/jwt/refresh/` | Public | Refresh access token |
| | `GET /api/auth/jwt/me/` | JWT | Current user profile |
| **Auth (legacy)** | `POST /api/token/` | Public | simplejwt obtain |
| **Admin** | `POST /api/schedules/generate` | Registrar | Generate schedule |
| | `GET /api/admin/dashboard/` | Registrar | Dashboard summary |
| | `GET /api/admin/stats/` | Registrar | Analytics stats |
| | `GET /api/admin/schedules/runs/{pk}/conflicts/` | Registrar | Schedule conflicts |
| **Professor** | `GET /api/professor/me/` | Professor | Profile + assignments |
| | `GET /api/professor/me/schedule/` | Professor | Weekly grid |
| | `GET /api/professor/me/schedule/conflicts/` | Professor | Personal conflicts |
| **Public** | `GET /api/public/schedules/` | None | Published terms |
| | `GET /api/public/schedules/{term}/` | None | Term schedule |
| | `GET /api/public/schedules/{term}/sections/` | None | Sections in term |
| **Admin (Advanced)** | `GET /api/audit/` | Registrar | Audit log |
| | `GET /api/settings/` | Registrar | Global settings |
| | `GET /api/admin/schedules/runs/{run_id}/conflict-resolutions/` | Registrar | Conflict resolutions |