# Glossary

| Term | Meaning |
| --- | --- |
| Academic term | A scheduling period identified by year and semester, with a `YYYY-S` code such as `2024-1`. |
| Active term | The term currently marked `is_active`; schedule generation uses it. |
| Assignment | A link between a professor, subject, section, and term. An assignment owns one or more meetings. |
| Availability window | A day/time range in which a professor is available to teach. May be marked preferred. |
| Busy block | A day/time range in which a professor is unavailable because of another commitment. |
| CFD | Context Flow Diagram: the Level 0 context view showing external actors and the system boundary. |
| Conflict | A violation of a scheduling rule, such as overlapping room use, capacity overflow, or excessive consecutive hours. |
| Conflict resolution | A database record describing a conflict and a proposed or completed resolution. The API can list, resolve, and ignore records, but records are not automatically created by current business operations. |
| Coverage | The proportion of required meetings or hours that have corresponding scheduled classes. |
| DFD | Data Flow Diagram. This documentation includes Level 1 and selected Level 2 decompositions. |
| Department | An organizational owner for professors and rooms. Used for department-scoped room assignment. |
| Feasible | A schedule run that satisfies all hard constraints. |
| Hard constraint | A rule that must hold for a schedule to be valid, such as no double-booking or respecting availability. |
| Infeasible | A schedule run that could not place every meeting or that violates a hard constraint. It is still persisted for diagnosis. |
| JWT | JSON Web Token. Access tokens authorize requests; refresh tokens obtain new access tokens. |
| Lab | A laboratory meeting mode with a default duration of three hours. |
| Meeting slot | A weekly component of an assignment, labeled `async`, `sync`, or `lab`, with an integer duration in hours. |
| Min-conflicts | An algorithm that starts with a rough assignment and repairs the worst conflicts iteratively. |
| Mode | The meeting category: asynchronous (`async`), synchronous (`sync`), or laboratory (`lab`). |
| Professor | A teacher profile linked one-to-one to an authentication user. |
| Public user | An unauthenticated visitor who can read published schedules. |
| Published run | A schedule run with `published=True`; public endpoints expose it. |
| Registrar | A staff user who manages data and schedule operations. |
| Run | A persisted schedule-generation attempt, represented by `ScheduleRun`. |
| Scheduled class | A placed meeting, represented by `ScheduledClass`, with day, start time, duration, room, and mode. |
| Scheduling engine | The pure-Python solver package under `backend/timetable/engines/`. It has no Django imports. |
| Section | A class group with a headcount, program label, year level, and optional term. |
| Soft score | A quality score where lower is better. It combines spread, consecutive-hour, and preferred-window penalties. |
| Spread | A penalty for uneven distribution of a professor's weekly load. |
| Sync | A synchronous meeting mode with a default duration of two hours. |
| Async | An asynchronous meeting mode with a default duration of one hour. |
| Workspace | The repository containing the Django backend, documentation, and a planned React frontend. |
