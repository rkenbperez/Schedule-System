# Introduction

## Purpose

Schedule Maker is a web application that builds a weekly class timetable for an
academic institution. Registrars enter the institution's catalog, professors,
teaching loads, and availability; the system then runs one of three scheduling
algorithms to place every required meeting into a room and time slot while
respecting hard constraints. The result is stored as a schedule run that can be
reviewed, compared, published, exported, and analyzed.

The backend is implemented in Django and Django REST Framework (DRF). A React
frontend is planned but not yet scaffolded; the documented interface is the REST
API, the Django admin, and the generated Swagger/ReDoc pages.

## Problem statement

Manual timetable construction is slow and error-prone. A registrar must satisfy
room capacity, department ownership, professor availability, section
availability, daily teaching limits, and the requirement that every subject has
at least one synchronous or laboratory meeting each week. A small change can
create conflicts elsewhere in the week.

Schedule Maker makes the constraints explicit, produces reproducible schedule
runs, measures result quality, and exposes analytics that show whether the
result is complete and balanced.

## Scope

### In scope

- Academic terms with one active term at a time.
- Departments, rooms, subjects, sections, professors, and professor profiles.
- Assignments with one or more weekly meetings, each labeled `async`, `sync`, or
  `lab`.
- Registrar-configurable default durations for each meeting mode.
- Professor availability windows and busy blocks.
- Schedule generation using `greedy`, `min_conflicts`, or `backtracking`.
- Schedule-run storage, review, conflict inspection, publishing, and public
  viewing of published schedules.
- Import from Excel/CSV, export to Excel/PDF, and template downloads.
- Registrar analytics for coverage, workload, room use, section coverage,
  schedule quality, and conflicts.
- JWT authentication, role-based authorization, audit-log read access, global
  settings, and conflict-resolution records.

### Out of scope / not implemented

- Student accounts, enrollment, grades, and student self-service.
- Program as a first-class database model.
- A React frontend or other browser UI inside this repository.
- Automatic creation of audit-log entries or conflict-resolution records by
  business operations. The APIs exist, but current code does not populate those
  tables automatically.
- Production-grade secret management, HTTPS termination, PostgreSQL, and a
  deployed production environment.
- Automatic schedule repair or optimization after a conflict is reviewed.

## Actors

| Actor | Description | Interface |
| --- | --- | --- |
| Registrar | Staff user who manages institutional data, generates and publishes schedules, and views analytics | REST API, Django admin |
| Professor | Teacher who maintains availability and busy blocks and views their own schedule | REST API |
| Public user | Anonymous visitor who views published schedules | Public REST endpoints |
| Django administrator | Staff user who manages users, professor profiles, and academic terms through Django admin | Django admin |
| Scheduler | Internal pure-Python engine invoked by the backend; not a human actor | Internal |

## Operating context

- One Django process serves the API at `/api/`.
- SQLite is the default database in development.
- JWTs are issued by the API; browser clients are expected to send
  `Authorization: Bearer <access-token>`.
- The scheduling engine is pure Python and does not import Django. The
  `scenario_builder` adapter converts database rows into engine input.
- The current deployment guidance is development-oriented. See
  [Configuration](configuration.md) and [Deployment](deployment.md) for the
  known hardening gaps.

## Key assumptions

1. A schedule belongs to one academic term, and a run is generated against the
   active term unless another term is explicitly selected.
2. A professor's load is represented by assignments; each assignment has one or
   more meetings.
3. Every assignment must contain at least one `sync` or `lab` meeting.
4. Meeting durations are measured in whole hours. The default is configured
   globally per mode and can be overridden per meeting.
5. A professor may only be placed in rooms belonging to their department; a room
   with no department is shared, and a professor with no department may use any
   room.
6. The scheduler may return an infeasible run. Infeasible runs are persisted so
   the registrar can inspect the violations.

## Related documents

- [Requirements](requirements.md)
- [Use cases](use-cases.md)
- [Architecture](architecture.md)
- [Data model](data-model.md)
- [Scheduling engine](scheduling-engine.md)
- [API reference](api-reference.md)
