"""Seed a small, idempotent demo dataset for the three demo logins.

Rerunning restores the demo accounts, catalog, and preferences to their
default values without creating duplicates.
"""

from datetime import date, time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Department, ProfessorSubject, Room, Section, Subject
from timetable.models import (
    AcademicTerm,
    Assignment,
    AvailabilityWindow,
    MeetingSlot,
)
from users.models import (
    PreferenceSubmission,
    ProfessorPreference,
    Professors,
    SubmissionItem,
)

User = get_user_model()

DEMO_PASSWORD = "TestPass123!"

DEMO_ACCOUNTS = {
    "registrar": {
        "username": "registrar.demo",
        "email": "registrar.demo@cvsu.edu.ph",
        "first_name": "CvSU",
        "last_name": "Registrar",
        "is_staff": True,
    },
    "dept_head": {
        "username": "depthead.cs",
        "email": "depthead.cs@cvsu.edu.ph",
        "first_name": "Maria",
        "last_name": "Cruz",
        "is_staff": False,
    },
    "professor": {
        "username": "prof.delacruz",
        "email": "prof.delacruz@cvsu.edu.ph",
        "first_name": "Juan",
        "last_name": "Dela Cruz",
        "is_staff": False,
    },
}

DEPARTMENTS = [
    "Computer Science",
    "Information Technology",
    "Mathematics",
    "General Education",
]

SUBJECTS = [
    ("CC101", "Programming Fundamentals", 3),
    ("CC102", "Database Systems", 3),
    ("CC104", "Software Engineering", 3),
    ("CS201", "Data Structures", 3),
    ("IT101", "Web Development", 3),
    ("IT102", "Multimedia Systems", 3),
    ("MATH101", "Discrete Mathematics", 3),
    ("GEC101", "Purposive Communication", 3),
]

SECTIONS = [
    ("BSCS-1A", 35),
    ("BSCS-2A", 30),
    ("BSCS-3A", 30),
    ("BSCS-4A", 25),
    ("BSIT-3A", 30),
]

# (name, capacity, department, room type)
ROOMS = [
    ("CS Lecture Room 1", 45, "Computer Science", Room.RoomType.LECTURE),
    ("CS Computer Laboratory 1", 40, "Computer Science", Room.RoomType.LABORATORY),
    ("IT Lecture Room 1", 45, "Information Technology", Room.RoomType.LECTURE),
    ("IT Computer Laboratory 1", 40, "Information Technology", Room.RoomType.LABORATORY),
    ("Math Room 1", 40, "Mathematics", Room.RoomType.LECTURE),
    ("GenEd Room 1", 50, "General Education", Room.RoomType.LECTURE),
]


class Command(BaseCommand):
    help = "Create/update idempotent demo accounts, catalog, and preferences."

    @transaction.atomic
    def handle(self, *args, **options):
        term = self._seed_term()
        accounts = self._seed_accounts()
        departments = self._seed_departments(accounts["dept_head"])
        self._seed_catalog(term, departments)
        professor = self._seed_professor(accounts["professor"], departments)
        self._seed_preferences(term, professor, accounts["dept_head"])

        self.stdout.write(
            self.style.SUCCESS(
                "Demo data ready. Log in with any demo account and "
                f"password {DEMO_PASSWORD}"
            )
        )

    def _seed_term(self):
        today = date.today()
        term, _ = AcademicTerm.objects.update_or_create(
            year=today.year,
            semester=1,
            defaults={
                "start_date": date(today.year, 8, 1),
                "end_date": date(today.year, 12, 20),
                "is_active": True,
            },
        )
        AcademicTerm.objects.exclude(pk=term.pk).update(is_active=False)
        return term

    def _seed_accounts(self):
        accounts = {}
        for key, data in DEMO_ACCOUNTS.items():
            user, _ = User.objects.update_or_create(
                username=data["username"],
                defaults={
                    "email": data["email"],
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "is_staff": data["is_staff"],
                    "is_active": True,
                },
            )
            if not user.check_password(DEMO_PASSWORD):
                user.set_password(DEMO_PASSWORD)
                user.save(update_fields=["password"])
            accounts[key] = user
        return accounts

    def _seed_departments(self, dept_head):
        departments = {
            name: Department.objects.get_or_create(name=name)[0]
            for name in DEPARTMENTS
        }
        cs = departments["Computer Science"]
        if cs.head_id != dept_head.id:
            cs.head = dept_head
            cs.save(update_fields=["head"])
        return departments

    def _seed_catalog(self, term, departments):
        for code, title, units in SUBJECTS:
            Subject.objects.update_or_create(
                code=code, defaults={"title": title, "units": units}
            )
        for name, headcount in SECTIONS:
            Section.objects.update_or_create(
                name=name, defaults={"headcount": headcount, "term": term}
            )
        for name, capacity, dept_name, room_type in ROOMS:
            Room.objects.update_or_create(
                name=name,
                defaults={
                    "capacity": capacity,
                    "department": departments[dept_name],
                    "room_type": room_type,
                },
            )

    def _seed_professor(self, user, departments):
        department = departments["Computer Science"]
        professor, _ = Professors.objects.update_or_create(
            user=user,
            defaults={
                "department": department,
                "max_daily_hours": 10,
                "max_consecutive": 6,
            },
        )
        for code in ("CC101", "CC102", "CC104", "CS201"):
            ProfessorSubject.objects.update_or_create(
                professor=professor,
                subject=Subject.objects.get(code=code),
                defaults={
                    "is_preferred": True,
                    "modality": ProfessorSubject.Modality.SYNCHRONOUS,
                },
            )
        AvailabilityWindow.objects.filter(prof=professor).delete()
        for day in range(5):
            AvailabilityWindow.objects.create(
                prof=professor,
                day=day,
                start_time=time(7, 0),
                end_time=time(19, 0),
                is_preferred=True,
            )
        return professor

    def _seed_preferences(self, term, professor, dept_head):
        # (subject, section, mode, days, start, end, priority, status)
        preferences = [
            ("CS201", "BSCS-2A", "sync", [0, 2, 4], time(8, 0), time(9, 0), 1, "published"),
            ("CC102", "BSCS-3A", "lab", [1, 3], time(10, 0), time(12, 0), 2, "published"),
            ("CC104", "BSCS-4A", "async", [1], time(13, 0), time(14, 0), 3, "submitted"),
        ]
        published = []
        for code, section_name, mode, days, start, end, priority, status in preferences:
            subject = Subject.objects.get(code=code)
            section = Section.objects.get(name=section_name)
            minutes = end.hour * 60 + end.minute - (start.hour * 60 + start.minute)
            meeting = {
                "mode": mode,
                "duration_slots": max(1, -(-minutes // 60)),
                "preferred_days": days,
                "preferred_start": start.strftime("%H:%M"),
                "preferred_end": end.strftime("%H:%M"),
            }
            pref, _ = ProfessorPreference.objects.update_or_create(
                professor=professor,
                subject=subject,
                section=section,
                term=term,
                defaults={"priority": priority, "meetings": [meeting], "status": status},
            )
            if status == "published":
                published.append(pref)

            assignment, _ = Assignment.objects.update_or_create(
                prof=professor,
                subject=subject,
                section=section,
                term=term,
                defaults={"source": Assignment.Source.MANUAL},
            )
            MeetingSlot.objects.update_or_create(
                assignment=assignment,
                order=1,
                defaults={"mode": mode, "duration_slots": meeting["duration_slots"]},
            )
            assignment.meetings.exclude(order=1).delete()

        submission, _ = PreferenceSubmission.objects.update_or_create(
            department=Department.objects.get(name="Computer Science"),
            term=term,
            defaults={"submitted_by": dept_head, "status": "pending"},
        )
        for pref in published:
            SubmissionItem.objects.update_or_create(
                submission=submission,
                preference=pref,
                defaults={"action": "publish", "notes": ""},
            )
