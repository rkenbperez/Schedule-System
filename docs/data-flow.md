# Data Flow

This page contains the Context Flow Diagram (CFD), DFD Level 1, and selected
Level 2 decompositions. Data stores correspond to Django models; “cache” is the
Django cache used for import previews.

## Context Flow Diagram (CFD / DFD Level 0)

The CFD shows the system boundary and the external actors. It deliberately hides
internal processes and data stores.

```mermaid
flowchart LR
    Registrar([Registrar])
    Professor([Professor])
    Public([Public user])
    Admin([Django administrator])

    System["Schedule Maker\n(Django REST API + engine)"]

    Registrar -->|"departments, rooms, subjects, sections, professors, assignments, settings"| System
    System -->|"schedule runs, classes, conflicts, analytics, exports, settings, audit records"| Registrar

    Professor -->|"availability, busy blocks"| System
    System -->|"own profile, own schedule, personal conflicts"| Professor

    Public -->|"term code, section identifier"| System
    System -->|"published timetable"| Public

    Admin -->|"users, professor profiles, academic terms"| System
    System -->|"admin views and validation errors"| Admin
```

### External data flows

| From | To | Data |
| --- | --- | --- |
| Registrar | System | Catalog records, assignments and meetings, import workbooks, settings changes, generation requests, publish requests |
| System | Registrar | Schedule runs and classes, dynamic conflicts, analytics, XLSX/PDF exports, settings, audit records |
| Professor | System | Availability windows and busy blocks |
| System | Professor | Professor profile, personal schedule, personal conflict report |
| Public | System | Term and section queries |
| System | Public | Published schedules only |
| Django administrator | System | Users, professor profiles, academic terms |
| System | Django administrator | Admin list/detail views and validation feedback |

## DFD Level 1

```mermaid
flowchart TB
    Registrar([Registrar])
    Professor([Professor])
    Public([Public user])
    Admin([Django administrator])

    P1["P1\nAuthenticate and authorize"]
    P2["P2\nManage catalog\n(departments, rooms, subjects, sections)"]
    P3["P3\nManage assignments, meetings,\navailability and busy blocks"]
    P4["P4\nGenerate schedule"]
    P5["P5\nReview and publish schedules"]
    P6["P6\nCalculate analytics and conflicts"]
    P7["P7\nImport and export data"]
    P8["P8\nManage settings, audit and\nconflict-resolution records"]

    D1[("D1 Users and professor profiles")]
    D2[("D2 Catalog")]
    D3[("D3 Academic terms, assignments, meetings")]
    D4[("D4 Availability and busy blocks")]
    D5[("D5 Schedule runs and classes")]
    D6[("D6 Global settings")]
    D7[("D7 Audit log")]
    D8[("D8 Conflict resolutions")]
    D9[("D9 Import-preview cache")]

    Registrar -->|"credentials"| P1
    Professor -->|"credentials"| P1
    Admin -->|"credentials"| P1
    P1 -->|"tokens and role"| Registrar
    P1 -->|"tokens and role"| Professor
    P1 -->|"session"| Admin

    Registrar -->|"catalog records"| P2
    P2 -->|"validated catalog"| D2
    D2 -->|"catalog data"| P3

    Professor -->|"availability and busy blocks"| P3
    Registrar -->|"assignments and meetings"| P3
    P3 -->|"assignments and meetings"| D3
    P3 -->|"availability and busy blocks"| D4

    Registrar -->|"algorithm and time limit"| P4
    D3 -->|"assignments and meetings"| P4
    D4 -->|"availability and busy blocks"| P4
    D2 -->|"rooms"| P4
    P4 -->|"run and placed classes"| D5
    P4 -->|"run status, violations, score"| Registrar

    Registrar -->|"run selection / publish request"| P5
    D5 -->|"run and classes"| P5
    P5 -->|"published state"| D5
    D5 -->|"published timetable"| Public

    Registrar -->|"analytics filters"| P6
    D2 -->|"catalog and sections"| P6
    D3 -->|"assignments"| P6
    D4 -->|"availability"| P6
    D5 -->|"classes"| P6
    P6 -->|"coverage, quality, workload,\nrooms, sections and conflicts"| Registrar

    Registrar -->|"workbook or export request"| P7
    P7 -->|"parsed data"| D9
    D9 -->|"validated preview"| P7
    P7 -->|"imported catalog and assignments"| D2
    P7 -->|"imported assignments and availability"| D3
    P7 -->|"imported availability"| D4
    P7 -->|"XLSX/PDF file"| Registrar

    Registrar -->|"settings changes"| P8
    P8 -->|"validated settings"| D6
    D6 -->|"runtime configuration"| P3
    D6 -->|"duration defaults"| P4
    Registrar -->|"audit and conflict queries"| P8
    D7 -->|"audit records"| P8
    D8 -->|"resolution records"| P8
    P8 -->|"settings, audit and resolution data"| Registrar

    Professor -->|"personal schedule request"| P5
    P5 -->|"own classes"| Professor
```

### Data stores

| Store | Underlying data | Written by | Read by |
| --- | --- | --- | --- |
| D1 Users and professor profiles | `auth.User`, `Professors` | Django admin, professor viewset | Auth, schedule builder, analytics |
| D2 Catalog | `Department`, `Room`, `Subject`, `Section` | Catalog viewsets, importer, Django admin | Scenario builder, analytics, import/export |
| D3 Academic terms, assignments, meetings | `AcademicTerm`, `Assignment`, `MeetingSlot` | Django admin, assignment endpoints, importer, demo command | Scenario builder, analytics, professor views |
| D4 Availability and busy blocks | `AvailabilityWindow`, `BusyBlock` | Professor/staff viewsets, importer, demo command | Scenario builder, conflict auditor, analytics |
| D5 Schedule runs and classes | `ScheduleRun`, `ScheduledClass` | Generation, publish endpoint, demo command | Review, public schedule, analytics, export |
| D6 Global settings | `GlobalSettings` | Settings endpoints, migration seed | Serializers, bulk assignment view, importer |
| D7 Audit log | `AuditLog` | External tooling / future instrumentation | Audit endpoint |
| D8 Conflict resolutions | `ConflictResolution` | External tooling / future instrumentation | Conflict-resolution endpoints |
| D9 Import-preview cache | Django cache entry `import_preview_<token>` | Import preview | Import commit |

## DFD Level 2 — Schedule generation (P4)

```mermaid
flowchart LR
    Registrar([Registrar])
    P41["4.1\nLoad active term\nand build scenario"]
    P42["4.2\nRun selected algorithm"]
    P43["4.3\nPersist schedule run\nand classes"]
    P44["4.4\nFormat response"]
    D2[("D2 Catalog: rooms")]
    D3[("D3 Assignments and meetings")]
    D4[("D4 Availability and busy blocks")]
    D5[("D5 Schedule runs and classes")]

    Registrar -->|"algorithm, time_limit_s"| P41
    D2 -->|"rooms and departments"| P41
    D3 -->|"active-term assignments and meetings"| P41
    D4 -->|"availability and busy blocks"| P41
    P41 -->|"scenario"| P42
    P42 -->|"placements, violations, score, runtime"| P43
    P43 -->|"run + ScheduledClass rows"| D5
    P43 -->|"result summary"| P44
    P44 -->|"run_id, status, feasible,\nruntime_ms, soft_score,\nclass_count, violations, unplaced"| Registrar
```

Generation is synchronous and wrapped in a database transaction for the run and
class writes. An invalid algorithm or missing active term stops before engine
execution.

## DFD Level 2 — Import preview and commit (P7)

```mermaid
flowchart LR
    Registrar([Registrar])
    P71["7.1\nParse and validate\nworkbook"]
    P72["7.2\nReturn preview and cache\nparsed data (TTL 900 s)"]
    P73["7.3\nCommit with preview token"]
    D2[("D2 Catalog")]
    D3[("D3 Assignments and availability")]
    D9[("D9 Import-preview cache")]

    Registrar -->|"XLSX/CSV upload"| P71
    P71 -->|"parsed rows and errors"| P72
    P72 -->|"preview_token, summary,\ndetails, errors"| Registrar
    P72 -->|"parsed data"| D9
    Registrar -->|"preview_token"| P73
    D9 -->|"parsed data"| P73
    P73 -->|"departments, rooms, subjects,\nsections, professors"| D2
    P73 -->|"assignments, meetings,\navailability, busy blocks"| D3
    P73 -->|"commit result"| Registrar
```

The preview cache TTL is 900 seconds. With the default local-memory cache,
previews are process-local; a multi-process deployment needs a shared cache for
reliable commit behavior.

## DFD Level 2 — Analytics and conflict calculation (P6)

```mermaid
flowchart LR
    Registrar([Registrar])
    P61["6.1\nResolve term and run"]
    P62["6.2\nCalculate coverage, quality,\nworkload, rooms and sections"]
    P63["6.3\nAudit dynamic conflicts"]
    P64["6.4\nAssemble meta + summary + data"]
    D2[("D2 Catalog")]
    D3[("D3 Assignments")]
    D4[("D4 Availability")]
    D5[("D5 Runs and classes")]

    Registrar -->|"term, run, filters, pagination"| P61
    P61 -->|"selected context"| P62
    P61 -->|"selected context"| P63
    D2 -->|"rooms and sections"| P62
    D3 -->|"assignments and meetings"| P62
    D5 -->|"classes and run metadata"| P62
    D5 -->|"classes"| P63
    D4 -->|"availability windows"| P63
    P62 -->|"metrics"| P64
    P63 -->|"conflict details and summary"| P64
    P64 -->|"analytics envelope"| Registrar
```

Analytics is read-only. The conflict auditor detects partial overlaps, capacity
violations, availability violations, consecutive-hour violations, and daily-hour
violations. It does not create `ConflictResolution` rows.

## Trust boundaries

- The public internet is untrusted; all registrar and professor operations require
  JWT authentication and role checks.
- Django admin is a staff-only trust boundary.
- Imported spreadsheets are untrusted input and are validated before commit.
- The scheduler receives validated in-memory data and is isolated from HTTP
  concerns.
- The configured database (SQLite in development; PostgreSQL planned for
  production) and Django secret key are deployment-sensitive assets.

See [Security](security.md) for controls and gaps.
