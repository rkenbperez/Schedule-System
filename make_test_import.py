#!/usr/bin/env python3
"""
Generate a test Excel file for importing academic data into the Schedule-System.

IMPORTANT: The import validation is SELF-CONTAINED — IDs in each sheet reference
the `id` column of other sheets within this same file, NOT database IDs.

The commit uses `update_or_create(id=pk)`, so all IDs in this file use the
10000+ range to avoid colliding with existing database records (IDs 1-9999).

All names/codes use a "TEST-" prefix to avoid unique-constraint conflicts.

Sheets (all required by the import processor):
  Departments, Rooms, Subjects, Sections, Professors,
  Assignments, Meetings, Availability, BusyBlocks

Cross-references within this file:
  Assignments.professor_id → Professors.id
  Assignments.subject_id   → Subjects.id
  Assignments.section_id   → Sections.id
  Meetings.assignment_id   → Assignments.id
  Availability.professor_id → Professors.id
  BusyBlocks.professor_id  → Professors.id

Database requirements (resolved dynamically from the live DB):
  Professors.user_id uses the demo_prof1/2/3 auth users created by
  `python manage.py demo_schedule`.

Usage:
  backend/.venv/bin/python make_test_import.py
  # Then upload schedule_test_import.xlsx via /registrar/schedule-management
  # Click "Preview" to validate, then "Commit" to import
  # Then click "Generate Schedule" to run the engine
"""

import os
import sys
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402

django.setup()

from django.contrib.auth import get_user_model  # noqa: E402

from users.models import Professors  # noqa: E402

User = get_user_model()


def _demo_professor(username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise SystemExit(
            f"Missing demo user '{username}'. Run "
            "`cd backend && .venv/bin/python manage.py demo_schedule` first."
        )
    try:
        return Professors.objects.get(user=user)
    except Professors.DoesNotExist:
        raise SystemExit(
            f"User '{username}' has no professor profile. Run demo_schedule first."
        )


demo_profiles = [_demo_professor(f"demo_prof{i}") for i in (1, 2, 3)]
prof_ids = [profile.id for profile in demo_profiles]

wb = Workbook()

OFFSET = 10000  # avoid colliding with existing DB records

# ---------------------------------------------------------------------------
# 1. Departments  (required: name)
# ---------------------------------------------------------------------------
ws = wb.active
ws.title = "Departments"
ws.append(["id", "name"])
departments = [
    (OFFSET + 1, "TEST-Computer Science"),
    (OFFSET + 2, "TEST-Mathematics"),
    (OFFSET + 3, "TEST-Information Technology"),
]
for did, name in departments:
    ws.append([did, name])

# ---------------------------------------------------------------------------
# 2. Rooms  (required: name, capacity; optional: department_id)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Rooms")
ws.append(["id", "name", "capacity", "department_id"])
rooms = [
    (OFFSET + 1, "TEST-R101", 60, OFFSET + 1),
    (OFFSET + 2, "TEST-R102", 45, OFFSET + 1),
    (OFFSET + 3, "TEST-LAB1", 40, None),
    (OFFSET + 4, "TEST-GEC1", 45, OFFSET + 2),
]
for rid, name, cap, dept in rooms:
    ws.append([rid, name, cap, dept if dept is not None else ""])

# ---------------------------------------------------------------------------
# 3. Subjects  (required: code, title; optional: units)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Subjects")
ws.append(["id", "code", "title", "units"])
subjects = [
    (OFFSET + 1, "TEST101", "TEST Introduction to Programming", 3),
    (OFFSET + 2, "TEST102", "TEST Database Systems", 3),
    (OFFSET + 3, "TEST103", "TEST Web Development", 3),
    (OFFSET + 4, "TEST104", "TEST Discrete Mathematics", 3),
]
for sid, code, title, units in subjects:
    ws.append([sid, code, title, units])

# ---------------------------------------------------------------------------
# 4. Sections  (required: name, headcount; optional: term_id)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Sections")
ws.append(["id", "name", "headcount", "term_id"])
# All reference term_id=1 (active: First Semester 2024)
sections = [
    (OFFSET + 1, "TEST-1A", 33, 1),
    (OFFSET + 2, "TEST-2A", 28, 1),
    (OFFSET + 3, "TEST-3A", 35, 1),
    (OFFSET + 4, "TEST-4A", 30, 1),
]
for secid, name, headcount, term_id in sections:
    ws.append([secid, name, headcount, term_id])

# ---------------------------------------------------------------------------
# 5. Professors  (required: user_id; optional: department_id, max_daily_hours, max_consecutive)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Professors")
ws.append(["id", "user_id", "department_id", "max_daily_hours", "max_consecutive"])
# Reuse the existing demo professor profiles so update_or_create updates them
# instead of creating rows that would violate the one-profile-per-user rule.
professors = [
    (demo_profiles[0].id, demo_profiles[0].user_id, OFFSET + 1, 8, 4),
    (demo_profiles[1].id, demo_profiles[1].user_id, OFFSET + 2, 8, 4),
    (demo_profiles[2].id, demo_profiles[2].user_id, OFFSET + 3, 8, 4),
]
for pid, user_id, dept_id, max_daily, max_consec in professors:
    ws.append([pid, user_id, dept_id, max_daily, max_consec])

# ---------------------------------------------------------------------------
# 6. Assignments  (required: professor_id, subject_id, section_id; optional: term_id)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Assignments")
ws.append(["id", "professor_id", "subject_id", "section_id", "term_id"])
# professor_id → Professors.id (resolved from demo_prof1/2/3 above)
# subject_id → Subjects.id (10001-10004 — new)
# section_id → Sections.id (10001-10004 — new)
# term_id → 1 (active term)
assignments = [
    (OFFSET + 1, prof_ids[0], OFFSET + 1, OFFSET + 1, 1),
    (OFFSET + 2, prof_ids[0], OFFSET + 2, OFFSET + 2, 1),
    (OFFSET + 3, prof_ids[1], OFFSET + 3, OFFSET + 3, 1),
    (OFFSET + 4, prof_ids[2], OFFSET + 4, OFFSET + 4, 1),
]
for aid, pid, sid, secid, tid in assignments:
    ws.append([aid, pid, sid, secid, tid])

# ---------------------------------------------------------------------------
# 7. Meetings  (required: assignment_id, order, mode; optional: duration_slots)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Meetings")
ws.append(["id", "assignment_id", "order", "mode", "duration_slots"])
# assignment_id → Assignments.id (10001-10004)
# mode: async | sync | lab  (each assignment needs >= 1 sync or lab)
meetings = [
    (OFFSET + 1, OFFSET + 1, 1, "sync", 2),   # assign10001: sync 2hr
    (OFFSET + 2, OFFSET + 1, 2, "async", 1),  # assign10001: async 1hr
    (OFFSET + 3, OFFSET + 2, 1, "sync", 2),   # assign10002: sync 2hr
    (OFFSET + 4, OFFSET + 2, 2, "lab", 3),    # assign10002: lab 3hr
    (OFFSET + 5, OFFSET + 3, 1, "sync", 2),   # assign10003: sync 2hr
    (OFFSET + 6, OFFSET + 3, 2, "sync", 2),   # assign10003: sync 2hr (second meeting)
    (OFFSET + 7, OFFSET + 4, 1, "sync", 3),   # assign10004: sync 3hr
]
for mid, aid, order, mode, dur in meetings:
    ws.append([mid, aid, order, mode, dur])

# ---------------------------------------------------------------------------
# 8. Availability  (required: professor_id, day, start_time, end_time; optional: is_preferred)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("Availability")
ws.append(["professor_id", "day", "start_time", "end_time", "is_preferred"])
# professor_id → Professors.id (resolved from demo_prof1/2/3 above)
# day: 0=Monday ... 5=Saturday ; time format HH:MM
availability = []
for pid in prof_ids:
    for day in range(5):  # Mon-Fri
        availability.append((pid, day, "07:00", "17:00", "true"))
for pid, day, st, et, pref in availability:
    ws.append([pid, day, st, et, pref])

# ---------------------------------------------------------------------------
# 9. BusyBlocks  (required: professor_id, day, start_time, end_time)
# ---------------------------------------------------------------------------
ws = wb.create_sheet("BusyBlocks")
ws.append(["professor_id", "day", "start_time", "end_time"])
# No busy blocks — keep schedule flexible

wb.save("schedule_test_import.xlsx")
print("Created schedule_test_import.xlsx")
print()
print("Sheets:", wb.sheetnames)
print()
print("All IDs use offset 10000 to avoid DB collisions.")
print()
print("Cross-reference key (local IDs within this file):")
print(f"  Professors.id:   {prof_ids} (resolved from demo_prof1/2/3)")
print("  Professors.department_id → Departments.id (10001,10002,10003)")
print(f"  Subjects.id:     {OFFSET+1}=TEST101, {OFFSET+2}=TEST102, {OFFSET+3}=TEST103, {OFFSET+4}=TEST104")
print(f"  Sections.id:     {OFFSET+1}=TEST-1A, {OFFSET+2}=TEST-2A, {OFFSET+3}=TEST-3A, {OFFSET+4}=TEST-4A")
print(f"  Assignments.id:  {OFFSET+1}-{OFFSET+4}")
print(f"  Meetings.id:     {OFFSET+1}-{OFFSET+7}")
print()
print("Import this file at: http://localhost:5173/registrar/schedule-management")
print("Click Preview → Commit → Generate Schedule")
