# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning where practical.

## [1.3.0] - 2026-10-24

### Added

- Public `GET /api/health/` endpoint that verifies database connectivity and
  returns `200` or `503`.
- Registrar analytics APIs for overview, schedule quality, professor workload,
  room utilization, and section coverage.
- Shared conflict auditor used by analytics and the existing conflict
  endpoints, including partial-overlap detection.
- Configurable meeting-duration defaults for `async`, `sync`, and `lab` modes.
- Documentation set covering requirements, use cases, architecture, data model,
  CFD/DFD, API, security, configuration, deployment, testing, operations, and
  traceability.
- Generated OpenAPI schema artifact and a curated API reference.

### Changed

- Demo seeding now uses the configured mode-duration defaults when a demo
  meeting omits a duration, while preserving explicit fixture overrides.
- Assignment and import defaults resolve durations through the shared settings
  helper instead of hardcoded values.
- Global settings updates preserve existing descriptions when omitted and
  validate duration values as positive whole numbers.
- Documentation now has one owner per topic, current test status, and a single
  consolidated production-readiness section.
- The stale `plan.md` implementation plan was removed.

### Fixed

- Demo schedules no longer hardcode one-hour synchronous and laboratory
  meetings.
- Conflict detection now catches partial interval overlaps rather than only
  classes with identical start times and durations.

## [1.2.0]

### Added

- Departments and department-scoped room assignment.
- Per-meeting modes and configurable duration behavior.
- Class end-time reporting.
- Demo datasets for normal and larger workloads.
- The rule requiring at least one synchronous (`sync` or `lab`) meeting per
  assignment.

## [1.1.0]

### Added

- Core domain models.
- Greedy, min-conflicts, and backtracking scheduling engines.
- Django REST Framework API.
- End-to-end API tests.
- Demo scheduling command.

## Earlier history

Changes before `v1.1.0` are available in the Git history. This file starts at
the first tagged release recorded in the repository.
