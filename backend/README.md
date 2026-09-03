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

### The three algorithms

The scheduler can search for a schedule in three different ways. This is the
research focus of the project: comparing how each one behaves.

| Algorithm     | Idea (in plain words)                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| `greedy`      | Fill the hardest classes first, place each in the first free slot that works, never undo a choice. Fast, but can get stuck. |
| `min_conflicts` | Start with a rough draft (even if it breaks rules), then repeatedly move the worst class until the clashes disappear. Good at improving a draft. |
| `backtracking`  | Try a choice; if it leads to a dead end, step back and try another. Guarantees an answer if one exists, but can be slower. |

For the same input, each algorithm reports how long it took (`runtime_ms`) and
how good the result is (`soft_score`, lower is better). That comparison is what
you show in your evaluation chapter.

---

## Roles

The API has two kinds of users.

| Role        | Who it is                     | What they can do                                              |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| Registrar   | The administrator (`is_staff`) | Create subjects, sections, rooms, professors, and assignments; generate schedules; see everything. |
| Professor   | A teacher                     | Set their own availability and busy blocks; view only their own schedule. |

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
3. Go to **Users → Add user**.
4. Set a username and password, and fill in the professor's details
   (department chosen from the list, daily limits) in the **Professors** section
   on the same form.

Rooms can be given a department in the same way (**Rooms → Add room**). Leave it
blank for a shared/general room.

---

## Using the API

Every request (except login) needs a token in the `Authorization` header. Note
the word `Token` followed by a space — it is required:

```
Authorization: Token <your-token>
```

### 1. Log in to get a token

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your-username", "password": "your-password"}'
```

The response contains a `token`. Use it in the following steps.

### 2. Add data

```bash
# Create a department and keep its id (from the response) for the next step
curl -X POST http://127.0.0.1:8000/api/departments/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "CS"}'

# The response body contains the new department's "id" (e.g. {"id": 5, "name": "CS"}).
# Use that value (not a hard-coded 1) as the room's "department":
curl -X POST http://127.0.0.1:8000/api/rooms/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "R101", "capacity": 40, "department": 5}'

# An assignment links a professor, subject, and section to one or more weekly
# meetings. Each meeting has a mode; length defaults from the mode (async 1h,
# sync 2h, lab 3h) but can be overridden per meeting with "duration_slots":
curl -X POST http://127.0.0.1:8000/api/assignments/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"prof": 1, "subject": 1, "section": 1, "meetings": [{"mode": "sync"}, {"mode": "async"}]}'
```

Similar endpoints exist for `subjects`, `sections`, `profs`,
`availability-windows`, and `busy-blocks`. Room and professor responses also
include a `department_name` for convenience.

### 3. Generate a schedule

```bash
curl -X POST http://127.0.0.1:8000/api/schedules/generate \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "greedy"}'
```

The response reports whether a valid schedule was found (`feasible`), how many
classes were placed, the time it took, and a quality score.

### 4. View the schedule

```bash
curl http://127.0.0.1:8000/api/schedules/runs/1/classes \
  -H "Authorization: Token <token>"
```

Professors can see their own classes with:

```bash
curl http://127.0.0.1:8000/api/schedules/my \
  -H "Authorization: Token <token>"
```

See the Swagger UI for the complete list of endpoints and their fields.

---

## Running the demo

A demo command seeds a small example and runs the whole flow against your
running server.

Open two terminals:

```bash
# terminal 1
python manage.py runserver
```

```bash
# terminal 2
python manage.py demo_schedule
```

It creates a dev-only demo registrar (`demoreg`) and three professors, seeds
subjects, sections, rooms, assignments, and availability, then generates a
schedule with all three algorithms and prints:

- a comparison table (`feasible`, `runtime_ms`, `soft_score`, class count)
- a readable Monday–Saturday grid of the best result

Add `--reset` to delete existing schedules, assignments, and availability
before re-running:

```bash
python manage.py demo_schedule --reset
```

> The demo accounts exist only on your development machine. They are not
> created on any deployed server.

---

## Running the tests

```bash
python manage.py test
```

The test suite (74 tests) checks, in plain terms:

- **Data rules** — invalid values (zero meeting length, a time range that ends
  before it starts, an unknown day) are rejected.
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

---

## Common problems

- **`401 Authentication credentials were not provided`** — you likely wrote the
  token without the prefix. The header must be `Authorization: Token <token>`,
  with the word `Token` and a space before the value.
- **`429 Too Many Requests` on login** — login is limited to 10 attempts per
  minute. Wait a minute and try again.
- **Professor can't log into `/admin/`** — that is expected. Only staff
  (registrar) accounts can use the admin site. Professors log in through the
  API.
