# Schedule Maker Documentation

This directory is the central documentation set for the Schedule Maker project.
It describes the implemented Django REST API, the scheduling engine, the data
model, and the operational workflows used by registrars and professors.

## Version and status

The latest release tag is **v1.2.0**. The current development version is
**1.3.0**, recorded in [`backend/VERSION`](../backend/VERSION). The `staging`
branch contains the post-tag work: registrar analytics, configurable
meeting-duration defaults, the health endpoint, and this documentation refresh.

Status labels used throughout the docs:

| Label | Meaning |
| --- | --- |
| **Implemented** | Present in the current codebase and covered by the API or Django admin |
| **Legacy** | Still available for compatibility, but not the recommended interface |
| **Planned** | Designed or discussed but not implemented |
| **Known gap** | A limitation or missing capability that users should be aware of |

## Audience

- **Registrars and operators** — day-to-day setup, schedule generation,
  publishing, imports/exports, analytics, and conflict review.
- **Professors** — availability, busy blocks, and personal schedule access.
- **Developers and maintainers** — architecture, data model, API contracts,
  security, configuration, deployment, and tests.
- **Thesis panels and reviewers** — requirements, use cases, data-flow diagrams,
  architecture, and traceability.

## Start here

| If you want to... | Read |
| --- | --- |
| Understand what the system does | [Introduction](introduction.md) |
| See requirements and business rules | [Requirements](requirements.md) |
| Understand actors and workflows | [Use cases](use-cases.md) |
| See the system structure | [Architecture](architecture.md) |
| Understand the database | [Data model](data-model.md) |
| See context, DFD, and process flows | [Data flow](data-flow.md) |
| Understand the solver | [Scheduling engine](scheduling-engine.md) |
| Call the API | [API reference](api-reference.md) |
| Review security and permissions | [Security](security.md) |
| Configure the system | [Configuration](configuration.md) |
| Run or deploy it | [Deployment](deployment.md) |
| Run and interpret tests | [Testing](testing.md) |
| Operate the demo and integrations | [Operations](operations.md) |
| Trace requirements to implementation | [Traceability](traceability.md) |
| Look up a term | [Glossary](glossary.md) |

## Documentation conventions

- Diagrams use **Mermaid** inside fenced `mermaid` blocks and render on GitHub.
- The **CFD** is the Context Flow Diagram and is equivalent to a DFD Level 0
  context view. DFD Level 1 and selected Level 2 decompositions are in
  [data-flow.md](data-flow.md).
- Endpoint tables describe authentication and purpose. Request and response
  fields are defined by the generated [OpenAPI schema](api/openapi.yaml) and
  the running Swagger UI at `/api/schema/swagger-ui/`. Some custom API views
  lack serializer annotations, so the [API reference](api-reference.md) notes
  where the schema is incomplete.
- Examples use `http://127.0.0.1:8000` and a bearer access token. Passwords and
  tokens in examples are placeholders, not secrets.
- Where documentation and code disagree, the code and generated schema are the
  source of truth. Please open an issue or PR to correct the documentation.

## Related project documents

- [Root README](../README.md) — project landing page and quickstart
- [Backend README](../backend/README.md) — backend setup and local runbook
- [Contributing guide](../CONTRIBUTING.md) — branch, PR, and release workflow
- [Changelog](../CHANGELOG.md) — release history
