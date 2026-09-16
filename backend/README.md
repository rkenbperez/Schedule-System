# Schedule Maker — Backend

A REST API that turns a professor's inputs — the subjects and sections they
teach, plus the times they are available — into a weekly timetable that spreads
classes across Monday to Saturday.

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
3. The registrar asks the system to **generate a schedule**. The scheduler
   places every class into a time slot and a room while respecting the rules.
4. The result is saved so it can be viewed or compared later.

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

A professor's load can mix modes — for example one assignment may have a
synchronous 2-hour lecture on Monday and an asynchronous 1-hour session on
Wednesday. The registrar can override the default length of any meeting. The
chosen mode and length are saved with each scheduled class so the output shows
whether a class is asynchronous, synchronous, or a laboratory session.

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

The API has three kinds of authenticated users plus public access.

| Role        | Who it is                     | Auth Method | What they can do                                              |
| ----------- | ----------------------------- | ----------- | ------------------------------------------------------------- |
| Registrar   | The administrator (`is_staff`) | JWT / Token | Create subjects, sections, rooms, professors, and assignments; generate schedules; see everything. |
| Professor   | A teacher                     | JWT / Token | Set their own availability and busy blocks; view only their own schedule. |
| Student     | Enrolled student              | JWT / Token | View their enrolled sections' schedules; see conflicts. |
| Public      | Anyone                        | None        | View published schedules (read-only). |

> A professor cannot log into the Django admin site (`/admin/`). Only a
> registrar (staff) account can. Professors and students use the API (or the future
> frontend) instead.

---

## Project layout

```
backend/
├── core/          Project settings and URL routing
├── catalog/       Departments, subjects, sections, and rooms
├── timetable/     Assignments, availability, schedules, and the algorithm engine
├── users/         Login, professor profiles, students, and enrollment
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
3. Go to **Users → Add user**.
4. Set a username and password, and fill in the professor's details
   (department chosen from the list, daily limits) in the **Professors** section
   on the same form.

Rooms can be given a department in the same way (**Rooms → Add room**). Leave it
blank for a shared/general room.

**Student:**

Students are created via the API (see Student endpoints below) or through the
Django admin site once the Student model is added.

---

## Authentication

The API supports two authentication methods:

### 1. Token Authentication (Legacy/Development)
Every request (except login) needs a token in the `Authorization` header:

```
Authorization: Token <your-token>
```

Get a token via the login endpoint:
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

### 2. JWT Authentication (Production)
JWT provides access + refresh tokens with rotation and blacklisting:

```bash
# Obtain token pair
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'

# Response: {"access": "...", "refresh": "..."}

# Use access token
Authorization: Bearer <access-token>

# Refresh when expired
curl -X POST http://127.0.0.1:8000/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh-token>"}'

# Verify token
curl -X POST http://127.0.0.1:8000/api/token/verify/ \
  -H "Content-Type: application/json" \
  -d '{"token": "<access-token>"}'
```

**JWT Settings (in `core/settings.py`):**
- Access token lifetime: 1 hour
- Refresh token lifetime: 7 days
- Rotate refresh tokens on use
- Blacklist old refresh tokens after rotation

JWT settings (in `core/settings.py`):
- Access token lifetime: 1 hour
- Refresh token lifetime: 7 days
- Rotate refresh tokens on use
- Blacklist old refresh tokens after rotation

---

## Using the API

All examples below use JWT Bearer tokens. Replace with `Token <token>` for legacy auth.

### 1. Add data (Registrar only)

```bash
# Create a department
curl -X POST http://127.0.0.1:8000/api/departments/ \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "CS"}'

# Create a room (use department id from response)
curl -X POST http://127.0.0.1:8000/api/rooms/ \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "R101", "capacity": 40, "department": 5}'

# Create assignment with meetings
curl -X POST http://127.0.0.1:8000/api/assignments/ \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"prof": 1, "subject": 1, "section": 1, "meetings": [{"mode": "sync"}, {"mode": "async"}]}'
```

Similar endpoints exist for `subjects`, `sections`, `profs`,
`availability-windows`, and `busy-blocks`.

### 2. Generate a schedule (Registrar only)

```bash
curl -X POST http://127.0.0.1:8000/api/schedules/generate \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "greedy", "time_limit_s": 30}'
```

Response includes `feasible`, `runtime_ms`, `soft_score`, `class_count`, `violations`, and `run_id`.

### 3. View schedules

**Registrar (all runs):**
```bash
curl http://127.0.0.1:8000/api/schedules/runs/ \
  -H "Authorization: Bearer <access-token>"
```

**Registrar/Professor (specific run):**
```bash
curl http://127.0.0.1:8000/api/schedules/runs/1/classes/ \
  -H "Authorization: Bearer <access-token>"
```

**Professor (own schedule):**
```bash
curl http://127.0.0.1:8000/api/schedules/my/ \
  -H "Authorization: Bearer <access-token>"
```

**Student (own enrolled schedule):**
```bash
curl http://127.0.0.1:8000/api/students/me/schedule?term=2024-FALL \
  -H "Authorization: Bearer <access-token>"
```

**Student (conflict detection):**
```bash
curl http://127.0.0.1:8000/api/students/me/schedule/conflicts?term=2024-FALL \
  -H "Authorization: Bearer <access-token>"
```

**Public (published schedules):**
```bash
curl http://127.0.0.1:8000/api/public/schedule?term=2024-FALL
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

Three dataset sizes are available:

| `--scale` | Professors | Assignments | Weekly meetings | Sections |
| --------- | ---------- | ----------- | --------------- | -------- |
| `normal` (default) | 7 | 35 | 53 | 10 |
| `large` | 11 | 52 | 79 | 14 |
| `full` | 16 | 159 | ~180 | 24 |

```bash
# Use the larger dataset (more sections and GE minors)
python manage.py demo_schedule --scale large

# Use the full dataset (near-complete realistic schedules for all sections)
python manage.py demo_schedule --scale full
```

Add `--reset` to delete existing demo schedules, assignments and availability
before re-running:

```bash
python manage.py demo_schedule --reset
```

**Filter by section (new):**
```bash
# Show schedule for a specific section with formatted output
python manage.py demo_schedule --scale full --section BSIT-3A --algorithm min_conflicts --time-limit 300
```

**CLI options:**
```bash
# Run specific algorithm
python manage.py demo_schedule --algorithm greedy --time-limit 10
python manage.py demo_schedule --algorithm min_conflicts --time-limit 60
python manage.py demo_schedule --algorithm backtracking

# Run all (default varies by scale)
python manage.py demo_schedule --algorithm all --time-limit 30
```

**Smart defaults per scale:**
| Scale | Default Algorithm | Default Time Limit |
|-------|------------------|-------------------|
| normal | `all` | 30s |
| large | `all` | 60s |
| full | `min_conflicts` | 120s |

> The demo accounts exist only on your development machine. They are not
> created on any deployed server.

### Using the demo with JWT

```bash
# Terminal 1: Start server
python manage.py runserver

# Terminal 2: Get JWT token for demo registrar
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "demoreg", "password": "demo12345"}'

# Use access token for API calls
export ACCESS_TOKEN=<your-access-token>

# Generate schedule with JWT
curl -X POST http://127.0.0.1:8000/api/schedules/generate \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "min_conflicts", "time_limit_s": 60}'

# View schedule for a specific section
curl "http://127.0.0.1:8000/api/schedules/runs/<run_id>/classes?section=<section_id>" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

> The demo accounts exist only on your development machine. They are not
> created on any deployed server.

**Filter by section (new):**
```bash
# Show schedule for a specific section with formatted output
python manage.py demo_schedule --scale full --section BSIT-3A --algorithm min_conflicts --time-limit 300
```

**CLI options:**
```bash
# Run specific algorithm
python manage.py demo_schedule --algorithm greedy --time-limit 10
python manage.py demo_schedule --algorithm min_conflicts --time-limit 60
python manage.py demo_schedule --algorithm backtracking

# Run all (default varies by scale)
python manage.py demo_schedule --algorithm all --time-limit 30
```

**Smart defaults per scale:**
| Scale | Default Algorithm | Default Time Limit |
|-------|------------------|-------------------|
| normal | `all` | 30s |
| large | `all` | 60s |
| full | `min_conflicts` | 120s |

> The demo accounts exist only on your development machine. They are not
> created on any deployed server.

---

## Running the tests

```bash
# All tests (Django native runner)
python manage.py test

# All tests (pytest with parallel execution)
pytest timetable/tests/ -n auto -v --tb=short

# Specific test modules
python manage.py test timetable.tests.test_stress
python manage.py test timetable.tests.test_rbac
python manage.py test timetable.tests.test_jwt_auth
python manage.py test timetable.tests.test_student_view
```

### Test categories

| Test File | Purpose |
|-----------|---------|
| `test_engines.py` | Algorithm correctness, constraints, scoring, departments |
| `test_api.py` | Full API flow, permissions, assignment validation |
| `test_stress.py` | Load tests (1000 sections), constraint extremes, edge cases |
| `test_rbac.py` | Role-based access control for all endpoints |
| `test_jwt_auth.py` | JWT obtain/refresh/verify, blacklist, protected endpoints |
| `test_student_view.py` | Student/public API endpoints (Phase 3) |
| `test_scenario_builder.py` | Django → Scenario data conversion |
| `test_models.py` | Model validation, constraints |

### Load testing (optional)

```bash
# Install locust
pip install locust

# Run headless load test
locust -f timetable/tests/locustfile.py --headless -u 10 -r 2 -t 60s
```

---

## Common problems

- **`401 Authentication credentials were not provided`** — you likely wrote the
  token without the prefix. The header must be `Authorization: Token <token>` (legacy) or `Authorization: Bearer <token>` (JWT).
- **`429 Too Many Requests` on login** — login is limited to 10 attempts per
  minute. Wait a minute and try again.
- **Professor can't log into `/admin/`** — that is expected. Only staff
  (registrar) accounts can use the admin site. Professors log in through the
  API.
- **`TokenError: Token is invalid or expired`** — JWT access token expired.
  Use the refresh endpoint to get a new access token.
- **Schedule generation returns `feasible: false`** — check `violations` for
  reasons (room conflicts, professor availability, consecutive hours, etc.).
- **Consecutive hours violations** — ensure professors have appropriate
  `max_consecutive` values set for their workload.

---

## Configuration

Key settings in `core/settings.py`:

```python
# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# API
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# Scheduler defaults
DEFAULT_DAY_RANGES = {
    0: (7 * 60, 19 * 60),  # Mon-Fri 07:00-19:00
    1: (7 * 60, 19 * 60),
    2: (7 * 60, 19 * 60),
    3: (7 * 60, 19 * 60),
    4: (7 * 60, 19 * 60),
    5: (7 * 60, 13 * 60),  # Saturday 07:00-13:00
}
SLOT_MINUTES = 60  # Base time slot granularity
```

---

## Architecture notes

- **Pure Python engines** (`timetable/engines/`): No Django imports, testable in isolation.
- **Scenario builder** (`timetable/scenario_builder.py`): Only Django-touching code in the solver path.
- **Constraint validation** (`timetable/engines/constraints.py`): Shared hard/soft constraint logic.
- **Three algorithms**: `greedy`, `min_conflicts`, `backtracking` in `timetable/engines/`.
- **Soft scoring** (`timetable/engines/scoring.py`): Prefers spread schedules over clumped ones.
