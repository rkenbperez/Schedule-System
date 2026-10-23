# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning where practical.

> **Version metadata note:** `backend/VERSION` still contains `0.1.0.0` and is not
> authoritative. The Git tags are the release reference; the latest tag is
> `v1.2.0`, and `staging` contains changes after that tag. Dates for the earlier
> tags were not recorded in the repository.

## [Unreleased]

### Added

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

### Fixed

- Demo schedules no longer hardcode one-hour synchronous and laboratory
  meetings.
- Conflict detection now catches partial interval overlaps rather than only
  classes with identical start times and durations.

### Known gaps

- Login throttling is defined but not attached to the login view.
- Audit-log and conflict-resolution records are not created automatically.
- The full test suite is not green; see [Testing](docs/testing.md).
- The frontend and student/enrollment/program features are not implemented.
- Production settings are not hardened.

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
