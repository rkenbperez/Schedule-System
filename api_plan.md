# Full-Stack API Plan: Frontend ↔ Backend Data Flow

## 1. Django Apps to Create

Following the design doc's folder architecture:

```
server/apps/
├── __init__.py
├── accounts/      → users & teacher profiles
├── academics/     → terms, courses, sections, course_components
├── rooms/         → room types & rooms
├── scheduling/    → time slots, course assignments, schedules
└── students/      → student-facing schedule lookup (no auth)
```

---

## 2. API Endpoints & Data Contracts

### A. `accounts/` — Auth & Teacher Profiles

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| POST | `/api/auth/login/` | Teacher/Admin login | `{ email, password }` | `{ access, refresh, user: { id, email, role, teacher: { id, full_name, employee_no } } }` |
| POST | `/api/auth/refresh/` | Refresh JWT token | `{ refresh }` | `{ access }` |
| GET | `/api/auth/me/` | Get current user | — | `{ id, email, role, teacher: { id, full_name, employee_no } }` |
| GET | `/api/teachers/` | List teachers (admin) | — | `[{ id, employee_no, full_name, user: { email } }]` |

**Frontend hook:** `useMutation` for login, `useQuery` for `/me/`

---

### B. `academics/` — Terms, Courses, Sections

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| GET | `/api/terms/` | List all terms | — | `[{ id, name, school_year, term_type, is_active }]` |
| GET | `/api/terms/active/` | Get current active term | — | `{ id, name, school_year, term_type }` |
| GET | `/api/courses/` | List all courses | — | `[{ id, code, title, units }]` |
| GET | `/api/courses/{id}/components/` | Get components for a course | — | `[{ id, label, room_type: { id, name } }]` |
| GET | `/api/sections/` | List sections (for a term) | `?term={id}` | `[{ id, code, program, year_level, student_count }]` |

**Frontend hooks:** `useQuery(['courses'])`, `useQuery(['sections', termId])`, `useQuery(['courseComponents', courseId])`

---

### C. `rooms/` — Room Types & Rooms

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| GET | `/api/room-types/` | List room types | — | `[{ id, name }]` |
| GET | `/api/rooms/` | List rooms | `?type={id}` | `[{ id, code, capacity, room_type: { id, name } }]` |
| GET | `/api/rooms/available/` | Rooms available for a slot | `?term={id}&day={0-4}&slot={id}&room_type={id}&min_capacity={n}` | `[{ id, code, capacity }]` |

---

### D. `scheduling/` — Assignments & Schedules (Core)

This is the most important app. The frontend data needs map directly here:

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| GET | `/api/assignments/` | Teacher's assignments for active term | `?teacher={id}&term={id}` | See below |
| GET | `/api/assignments/{id}/` | Single assignment detail | — | See below |
| GET | `/api/assignments/{id}/components/` | Components + schedule status | — | See below |
| GET | `/api/assignments/{id}/available-slots/` | Available day+time for a component | `?component={id}` | See below |
| POST | `/api/schedules/` | **Create a schedule** | See below | See below |
| GET | `/api/schedules/` | Teacher's schedules for term | `?teacher={id}&term={id}` | See below |
| DELETE | `/api/schedules/{id}/` | Remove a schedule | — | `204` |

#### `GET /api/assignments/` Response (maps to `mockAssignments`):

```json
[
  {
    "id": 1,
    "course": { "id": 10, "code": "COSC 7", "title": "Data Structures and Algorithms" },
    "section": { "id": 5, "code": "3-A", "year_level": 3, "student_count": 30 },
    "component": { "id": 1, "label": "lecture", "room_type": "Lecture" },
    "scheduled": true
  },
  {
    "id": 2,
    "course": { "id": 10, "code": "COSC 7", "title": "Data Structures and Algorithms" },
    "section": { "id": 5, "code": "3-A", "year_level": 3, "student_count": 30 },
    "component": { "id": 2, "label": "laboratory", "room_type": "Laboratory" },
    "scheduled": false
  }
]
```

#### `GET /api/assignments/{id}/components/` Response:

```json
{
  "assignment_id": 1,
  "course": { "code": "COSC 7", "title": "Data Structures and Algorithms" },
  "section": { "code": "3-A", "student_count": 30 },
  "components": [
    {
      "id": 1,
      "label": "lecture",
      "room_type": "Lecture",
      "scheduled": true,
      "schedule": { "id": 1, "day_of_week": 0, "time_slot": "7:00 AM - 10:00 AM", "room": "Room 101" }
    },
    {
      "id": 2,
      "label": "laboratory",
      "room_type": "Laboratory",
      "scheduled": false,
      "schedule": null
    }
  ]
}
```

#### `GET /api/assignments/{id}/available-slots/` Response:

```json
{
  "component_id": 2,
  "room_type": "Laboratory",
  "slots": [
    { "day_of_week": 0, "day_label": "Monday", "time_slot_id": 1, "time_label": "7:00 AM - 10:00 AM", "available": false, "reason": "teacher_conflict" },
    { "day_of_week": 0, "day_label": "Monday", "time_slot_id": 3, "time_label": "1:00 PM - 3:00 PM", "available": true },
    { "day_of_week": 1, "day_label": "Tuesday", "time_slot_id": 2, "time_label": "10:00 AM - 1:00 PM", "available": true },
    { "day_of_week": 2, "day_label": "Wednesday", "time_slot_id": 4, "time_label": "3:00 PM - 6:00 PM", "available": false, "reason": "section_conflict" },
    { "day_of_week": 3, "day_label": "Thursday", "time_slot_id": 3, "time_label": "1:00 PM - 3:00 PM", "available": true },
    { "day_of_week": 4, "day_label": "Friday", "time_slot_id": 1, "time_label": "7:00 AM - 10:00 AM", "available": true }
  ]
}
```

#### `POST /api/schedules/` — Create Schedule Request:

```json
{
  "course_assignment_id": 1,
  "course_component_id": 2,
  "day_of_week": 3,
  "time_slot_id": 3
}
```

**Backend logic (service layer):**
1. Lock `teacher`, `section`, and `room` rows with `select_for_update`
2. Check teacher conflict → 409 if conflict
3. Check section conflict → 409 if conflict
4. Auto-assign room: find rooms matching `component.room_type`, `capacity >= section.student_count`, not booked for that `term/day/slot`
5. Create schedule row with denormalized `teacher_id`, `section_id`, `academic_term_id`, `room_id`
6. Return created schedule

#### `POST /api/schedules/` Response (201):

```json
{
  "id": 7,
  "course_assignment": 1,
  "course_component": { "id": 2, "label": "laboratory" },
  "room": { "id": 15, "code": "Lab 202", "capacity": 35 },
  "day_of_week": 3,
  "time_slot": { "id": 3, "label": "1:00 PM - 3:00 PM" },
  "academic_term": { "id": 1, "name": "1st Semester" }
}
```

#### `GET /api/schedules/` Response (maps to `mockSchedules`):

```json
[
  {
    "id": 1,
    "course": { "code": "COSC 7", "title": "Data Structures and Algorithms" },
    "section": { "code": "3-A", "student_count": 30 },
    "component": { "label": "lecture" },
    "room": { "code": "Room 101" },
    "day_of_week": 0,
    "time_slot": { "label": "7:00 AM - 10:00 AM" }
  }
]
```

---

### E. `students/` — Schedule Lookup (No Auth)

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| GET | `/api/student/schedule/` | Lookup by section code + term | `?section={code}&term={id}` | Array of schedule objects |

---

## 3. Frontend React Query Hooks

Create `src/api/` folder:

```
src/api/
├── client.ts          → Axios/fetch wrapper with JWT interceptor
├── useAuth.ts         → useLogin mutation, useMe query
├── useAssignments.ts  → useQuery for teacher assignments
├── useSchedules.ts    → useQuery for schedules, useCreateSchedule mutation
├── useCourses.ts      → useQuery for courses, components
└── useTerms.ts        → useQuery for active term
```

**Example hook pattern:**

```typescript
// useAssignments.ts
export function useAssignments(teacherId: number, termId: number) {
  return useQuery({
    queryKey: ['assignments', teacherId, termId],
    queryFn: () => api.get(`/api/assignments/?teacher=${teacherId}&term=${termId}`).then(r => r.data),
  });
}

export function useAssignmentDetail(id: number) {
  return useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.get(`/api/assignments/${id}/components/`).then(r => r.data),
    enabled: !!id,
  });
}

export function useAvailableSlots(assignmentId: number) {
  return useQuery({
    queryKey: ['availableSlots', assignmentId],
    queryFn: () => api.get(`/api/assignments/${assignmentId}/available-slots/`).then(r => r.data),
    enabled: !!assignmentId,
  });
}
```

---

## 4. Page → Endpoint Mapping

| Frontend Page | API Call | Mock Data It Replaces |
|---|---|---|
| `Login.tsx` | `POST /api/auth/login/` | (none) |
| `TeacherDashboardPage.tsx` | `GET /api/assignments/` + `GET /api/schedules/` | `mockAssignments`, `mockSchedules` |
| `TeacherCoursesPage.tsx` | `GET /api/assignments/` | `mockAssignments` |
| `TeacherCourseDetailsPage.tsx` | `GET /api/assignments/{id}/components/` | hardcoded component data |
| `CreateSchedulePage.tsx` | `GET /api/assignments/{id}/available-slots/` then `POST /api/schedules/` | hardcoded table rows |
| `TeacherSchedulesPage.tsx` | `GET /api/schedules/` | `mockSchedules` |

---

## 5. Execution Order

1. **Create Django apps** (`accounts`, `academics`, `rooms`, `scheduling`, `students`)
2. **Write models** for each app (1:1 mapping to the DDL in the design doc)
3. **Run migrations** (`python manage.py makemigrations && python manage.py migrate`)
4. **Seed data** (time slots, room types, sample rooms/courses)
5. **Write serializers** (DRF `ModelSerializer` for each model)
6. **Write views** (DRF `ModelViewSet` + custom actions for available-slots, etc.)
7. **Write service layer** (`scheduling_service.py` — conflict detection + room assignment)
8. **Wire URLs** in `config/urls.py`
9. **Create frontend API layer** (`src/api/`)
10. **Replace mock data** in pages with React Query hooks