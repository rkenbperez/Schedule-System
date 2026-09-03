"""Run the full schedule-creation flow against the live dev server.

Seeds an idempotent demo dataset (a registrar, professors across departments,
subjects, sections, rooms, assignments and availability), then logs in over
real HTTP, generates a schedule with all three engines, and prints a metrics
comparison plus a readable Monday-Saturday grid for the best-scoring feasible
result.

Two dataset sizes are available via ``--scale``:

* ``normal`` (default): 7 professors (CS, IT, MATH and GE), 18 subjects
  (majors plus GE minors such as GEC101, PE101 and NSTP101), 10 sections
  (first years included), 8 rooms and 35 assignments (53 weekly meetings).
* ``large``: 11 professors, 23 subjects, 14 sections, 12 rooms and 52
  assignments (79 weekly meetings).

Each run reconciles the database to the chosen scale: demo-managed subjects,
sections, rooms, assignments and availability that belong to another scale
are removed, so rerunning with ``--scale normal`` after ``--scale large``
does not leave stale records behind.

Usage (two terminals):

    # terminal 1
    python manage.py runserver

    # terminal 2
    python manage.py demo_schedule
    python manage.py demo_schedule --scale large
    python manage.py demo_schedule --reset
"""

import json
import urllib.error
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from catalog.models import Department, Room, Section, Subject
from timetable.models import Assignment, AvailabilityWindow, MeetingSlot
from users.models import Professors

User = get_user_model()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
DEMO_PASSWORD = "demo12345"
ALGORITHMS = ["greedy", "min_conflicts", "backtracking"]


def _dataset(scale):
    """Return the demo dataset for the requested scale.

    A "load" is (username, subject code, section name, spec) where spec lists
    the weekly meetings as (mode, duration_slots). Durations are set explicitly
    (not derived from the mode) so the mix stays realistic and feasible; rooms
    are matched to professor departments (LAB1 is shared).
    """
    departments = ["CS", "IT", "MATH", "GE"]

    normal = {
        "subjects": [
            ("CC101", "Programming Fundamentals"),
            ("CC102", "Database Systems"),
            ("CC103", "Networking"),
            ("CC104", "Software Engineering"),
            ("CS201", "Data Structures"),
            ("IT101", "Web Development"),
            ("IT102", "Multimedia Systems"),
            ("IT103", "Systems Administration"),
            ("MATH101", "Discrete Mathematics"),
            ("MATH201", "Statistics"),
            ("MATH202", "Linear Algebra"),
            ("MATH203", "Calculus"),
            ("GEC101", "Purposive Communication"),
            ("GEC102", "Mathematics in the Modern World"),
            ("GEC103", "Readings in Philippine History"),
            ("GEC104", "Science, Technology and Society"),
            ("PE101", "Physical Education 1"),
            ("NSTP101", "National Service Training Program 1"),
        ],
        "sections": [
            ("BSIT-3A", 30),
            ("BSIT-3B", 25),
            ("BSIT-4A", 28),
            ("BSCS-2A", 28),
            ("BSCS-3A", 30),
            ("BSCS-4A", 22),
            ("BSIT-2A", 30),
            ("BSIT-2B", 27),
            ("BSIT-1A", 35),
            ("BSCS-1A", 33),
        ],
        "rooms": [
            ("R201", 40, "CS"),
            ("R202", 40, "IT"),
            ("R301", 45, "CS"),
            ("R302", 45, "IT"),
            ("MATH1", 35, "MATH"),
            ("LAB1", 30, None),
            ("GEC1", 45, "GE"),
            ("GEC2", 45, "GE"),
        ],
        "availability": {
            "demo_prof1": [(d, "07:00:00", "19:00:00", True) for d in range(5)],
            "demo_prof2": [(d, "07:00:00", "19:00:00", True) for d in range(5)],
            "demo_prof3": [(d, "07:00:00", "19:00:00", True) for d in range(5)],
            "demo_prof4": [(d, "08:00:00", "18:00:00", True) for d in range(5)],
            "demo_prof5": [(d, "07:00:00", "17:00:00", True) for d in range(5)],
            "demo_prof6": [
                (0, "08:00:00", "17:00:00", False),
                (1, "08:00:00", "17:00:00", False),
                (2, "08:00:00", "17:00:00", False),
                (3, "08:00:00", "12:00:00", False),
                (3, "13:00:00", "17:00:00", False),
                (4, "08:00:00", "17:00:00", False),
            ],
            "demo_prof10": [(d, "07:00:00", "19:00:00", True) for d in range(5)],
        },
        "loads": [
            ("demo_prof1", "CC101", "BSIT-3A", [("sync", 1), ("async", 1)]),
            ("demo_prof1", "CC102", "BSCS-3A", [("sync", 2)]),
            ("demo_prof1", "CC104", "BSCS-4A", [("lab", 1), ("async", 1)]),
            ("demo_prof4", "CS201", "BSCS-2A", [("sync", 1), ("lab", 1)]),
            ("demo_prof4", "CC103", "BSIT-4A", [("sync", 1), ("async", 1)]),
            ("demo_prof4", "CC101", "BSIT-2A", [("sync", 1)]),
            ("demo_prof2", "IT101", "BSIT-3A", [("sync", 1), ("sync", 1)]),
            ("demo_prof2", "IT102", "BSIT-2B", [("lab", 1)]),
            ("demo_prof2", "IT103", "BSIT-2A", [("async", 1), ("sync", 1)]),
            ("demo_prof5", "IT102", "BSIT-4A", [("sync", 2)]),
            ("demo_prof5", "IT101", "BSIT-3B", [("sync", 1), ("async", 1)]),
            ("demo_prof5", "IT103", "BSCS-3A", [("sync", 1), ("lab", 1)]),
            ("demo_prof3", "MATH101", "BSCS-2A", [("sync", 1)]),
            ("demo_prof3", "MATH201", "BSIT-3A", [("sync", 1), ("lab", 1)]),
            ("demo_prof3", "MATH202", "BSCS-3A", [("sync", 2), ("async", 1)]),
            ("demo_prof6", "MATH203", "BSIT-2B", [("sync", 1), ("sync", 1)]),
            ("demo_prof6", "MATH101", "BSIT-4A", [("lab", 1)]),
            ("demo_prof6", "MATH201", "BSIT-2A", [("sync", 1), ("async", 1)]),
            ("demo_prof1", "CC101", "BSIT-1A", [("sync", 1), ("lab", 1)]),
            ("demo_prof4", "CC102", "BSCS-1A", [("sync", 1), ("async", 1)]),
            ("demo_prof3", "MATH101", "BSIT-1A", [("sync", 1), ("sync", 1)]),
            ("demo_prof6", "MATH203", "BSCS-1A", [("sync", 1), ("sync", 1)]),
            ("demo_prof2", "IT101", "BSIT-1A", [("sync", 1)]),
            ("demo_prof5", "IT102", "BSCS-1A", [("lab", 1)]),
            ("demo_prof10", "GEC101", "BSIT-1A", [("sync", 1)]),
            ("demo_prof10", "GEC101", "BSCS-1A", [("sync", 1)]),
            ("demo_prof10", "GEC102", "BSIT-1A", [("sync", 1), ("async", 1)]),
            ("demo_prof10", "GEC102", "BSCS-1A", [("sync", 1), ("async", 1)]),
            ("demo_prof10", "GEC103", "BSIT-2A", [("sync", 1)]),
            ("demo_prof10", "GEC103", "BSIT-2B", [("sync", 1)]),
            ("demo_prof10", "GEC104", "BSCS-2A", [("sync", 1)]),
            ("demo_prof10", "PE101", "BSIT-1A", [("sync", 1)]),
            ("demo_prof10", "PE101", "BSCS-1A", [("sync", 1)]),
            ("demo_prof10", "NSTP101", "BSIT-1A", [("sync", 1)]),
            ("demo_prof10", "NSTP101", "BSCS-1A", [("sync", 1)]),
        ],
    }

    large = {
        "subjects": normal["subjects"]
        + [
            ("CS202", "Operating Systems"),
            ("IT104", "Mobile Development"),
            ("IT105", "Networking 2"),
            ("MATH204", "Numerical Methods"),
            ("CS203", "Algorithms"),
        ],
        "sections": normal["sections"]
        + [
            ("BSCS-2B", 30),
            ("BSIT-1B", 32),
            ("BSCS-1B", 30),
            ("BSIT-4B", 25),
        ],
        "rooms": normal["rooms"]
        + [
            ("R303", 45, "CS"),
            ("R304", 45, "IT"),
            ("MATH2", 40, "MATH"),
            ("GEC3", 45, "GE"),
        ],
        "availability": {
            **normal["availability"],
            "demo_prof7": [(d, "07:00:00", "19:00:00", True) for d in range(5)],
            "demo_prof8": [(d, "09:00:00", "18:00:00", True) for d in range(5)],
            "demo_prof9": [(d, "08:00:00", "16:00:00", False) for d in range(5)],
            "demo_prof11": [(d, "07:00:00", "17:00:00", True) for d in range(5)],
        },
        "loads": normal["loads"]
        + [
            ("demo_prof7", "CC104", "BSIT-3B", [("sync", 2)]),
            ("demo_prof7", "CS202", "BSCS-2B", [("sync", 1), ("lab", 1), ("async", 1)]),
            ("demo_prof7", "CS203", "BSCS-4A", [("sync", 1), ("sync", 1)]),
            ("demo_prof7", "CC102", "BSCS-1B", [("sync", 1), ("async", 1)]),
            ("demo_prof8", "IT104", "BSIT-1A", [("sync", 1), ("lab", 1)]),
            ("demo_prof8", "IT105", "BSIT-1B", [("sync", 2), ("async", 1)]),
            ("demo_prof8", "IT101", "BSIT-4B", [("sync", 1)]),
            ("demo_prof9", "MATH204", "BSIT-1A", [("sync", 1), ("lab", 1)]),
            ("demo_prof9", "MATH202", "BSIT-1B", [("sync", 1), ("async", 1)]),
            ("demo_prof9", "MATH203", "BSIT-4B", [("sync", 2)]),
            ("demo_prof11", "GEC101", "BSIT-1B", [("sync", 1)]),
            ("demo_prof11", "GEC101", "BSCS-1B", [("sync", 1)]),
            ("demo_prof11", "GEC102", "BSIT-1B", [("sync", 1), ("async", 1)]),
            ("demo_prof11", "GEC103", "BSCS-1B", [("sync", 1)]),
            ("demo_prof11", "GEC104", "BSCS-2B", [("sync", 1)]),
            ("demo_prof11", "PE101", "BSIT-1B", [("sync", 1)]),
            ("demo_prof11", "NSTP101", "BSCS-1B", [("sync", 1)]),
        ],
    }

    data = {"normal": normal, "large": large}[scale]
    dept_by_code = {
        "CC101": "CS", "CC102": "CS", "CC103": "CS", "CC104": "CS",
        "CS201": "CS", "CS202": "CS", "CS203": "CS",
        "IT101": "IT", "IT102": "IT", "IT103": "IT", "IT104": "IT", "IT105": "IT",
        "MATH101": "MATH", "MATH201": "MATH", "MATH202": "MATH",
        "MATH203": "MATH", "MATH204": "MATH",
        "GEC101": "GE", "GEC102": "GE", "GEC103": "GE", "GEC104": "GE",
        "PE101": "GE", "NSTP101": "GE",
    }
    return {"departments": departments, "dept_by_code": dept_by_code, **data}


class Command(BaseCommand):
    help = "Seed demo data and run schedule creation against the running server."

    def add_arguments(self, parser):
        parser.add_argument("--base", default="http://127.0.0.1:8000/api")
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo schedules/assignments/availability first",
        )
        parser.add_argument(
            "--allow-non-debug",
            action="store_true",
            help="Allow running when DEBUG is off (not recommended).",
        )
        parser.add_argument(
            "--scale",
            choices=["normal", "large"],
            default="normal",
            help="Demo dataset size: 'normal' (default) or 'large'.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["allow_non_debug"]:
            raise CommandError(
                "demo_schedule creates demo accounts with a fixed password and "
                "may only run with DEBUG enabled. Re-run with --allow-non-debug "
                "to override."
            )

        base = options["base"]
        if options["reset"]:
            self._reset()

        registrar = self._seed_users(options["scale"])
        self._seed_catalog(options["scale"])
        self._seed_load_and_availability(options["scale"])
        self._reconcile(options["scale"])

        self.stdout.write(f"Scale: {options['scale']}")
        self.stdout.write(f"Registrar: {registrar.username} / {DEMO_PASSWORD}")

        try:
            token = self._http(
                base,
                "POST",
                "/auth/login/",
                {"username": registrar.username, "password": DEMO_PASSWORD},
            )["token"]
        except urllib.error.URLError:
            self.stderr.write(
                "Could not reach the server. Start it first with "
                "`python manage.py runserver`."
            )
            return

        headers = {"Authorization": f"Token {token}"}

        results = {}
        for algorithm in ALGORITHMS:
            result = self._http(
                base,
                "POST",
                "/schedules/generate",
                {"algorithm": algorithm, "time_limit_s": 30},
                headers,
            )
            results[algorithm] = result
            self._print_result(algorithm, result)

        self._print_comparison(results)
        best = self._pick_best(results)
        classes = self._http(
            base, "GET", f"/schedules/runs/{best['run_id']}/classes", headers=headers
        )
        self._print_grid(best["algorithm"], classes)

    # -- seeding -----------------------------------------------------------

    def _seed_users(self, scale):
        registrar, created = User.objects.get_or_create(username="demoreg")
        if created:
            registrar.is_staff = True
            registrar.set_password(DEMO_PASSWORD)
            registrar.save()

        data = _dataset(scale)
        departments = {
            name: Department.objects.get_or_create(name=name)[0]
            for name in data["departments"]
        }
        prof_depts = {}
        for username, code, _sec, _spec in data["loads"]:
            if username not in prof_depts:
                prof_depts[username] = data["dept_by_code"][code]
        for username in data["availability"]:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            Professors.objects.get_or_create(
                user=user, defaults={"department": departments[prof_depts[username]]}
            )

        return registrar

    def _seed_catalog(self, scale):
        data = _dataset(scale)

        for code, title in data["subjects"]:
            Subject.objects.get_or_create(code=code, defaults={"title": title, "units": 3})

        for name, headcount in data["sections"]:
            Section.objects.get_or_create(name=name, defaults={"headcount": headcount})

        def department(name):
            return Department.objects.filter(name=name).first()

        for name, capacity, dept_name in data["rooms"]:
            room, created = Room.objects.get_or_create(
                name=name,
                defaults={
                    "capacity": capacity,
                    "department": department(dept_name) if dept_name else None,
                },
            )
            if not created:
                room.capacity = capacity
                room.department = department(dept_name) if dept_name else None
                room.save(update_fields=["capacity", "department"])

    def _seed_load_and_availability(self, scale):
        data = _dataset(scale)

        def prof(username):
            return Professors.objects.get(user__username=username)

        def subject(code):
            return Subject.objects.get(code=code)

        def section(name):
            return Section.objects.get(name=name)

        # Each load lists its weekly meetings as (mode, duration_slots).
        for username, code, sec_name, spec in data["loads"]:
            assignment, _ = Assignment.objects.get_or_create(
                prof=prof(username),
                subject=subject(code),
                section=section(sec_name),
            )
            assignment.meetings.all().delete()
            MeetingSlot.objects.bulk_create(
                [
                    MeetingSlot(
                        assignment=assignment,
                        order=order,
                        mode=mode,
                        duration_slots=duration,
                    )
                    for order, (mode, duration) in enumerate(spec, start=1)
                ]
            )

        # Delete-then-recreate so profs with split windows (e.g. a lunch gap)
        # don't collide with the previous run's windows.
        for username, windows in data["availability"].items():
            p = prof(username)
            AvailabilityWindow.objects.filter(prof=p).delete()
            AvailabilityWindow.objects.bulk_create(
                [
                    AvailabilityWindow(
                        prof=p,
                        day=day,
                        start_time=start,
                        end_time=end,
                        is_preferred=preferred,
                    )
                    for day, start, end, preferred in windows
                ]
            )

    def _reset(self):
        from timetable.models import ScheduledClass, ScheduleRun

        ScheduledClass.objects.all().delete()
        ScheduleRun.objects.all().delete()
        Assignment.objects.all().delete()
        AvailabilityWindow.objects.all().delete()

    def _reconcile(self, scale):
        """Drop demo-managed records that are not part of the requested scale.

        The catalog seed only ever upserts the records the current dataset
        declares, so rerunning with ``--scale normal`` after ``--scale large``
        would otherwise leave the larger scale's subjects, sections, rooms,
        assignments and availability windows behind. Only records whose names
        the demo datasets manage are ever removed; user-created data (e.g. a
        subject or room the registrar added manually) is left untouched.
        """
        data = _dataset(scale)

        managed_subjects = set()
        managed_sections = set()
        managed_rooms = set()
        managed_profs = set()
        managed_loads = set()
        for other in ("normal", "large"):
            other_data = _dataset(other)
            managed_subjects.update(c for c, _ in other_data["subjects"])
            managed_sections.update(n for n, _ in other_data["sections"])
            managed_rooms.update(n for n, _, _ in other_data["rooms"])
            managed_profs.update(other_data["availability"])
            managed_loads.update((u, c, s) for u, c, s, _ in other_data["loads"])

        selected_subjects = {c for c, _ in data["subjects"]}
        selected_sections = {n for n, _ in data["sections"]}
        selected_rooms = {n for n, _, _ in data["rooms"]}
        selected_profs = set(data["availability"])
        selected_loads = {(u, c, s) for u, c, s, _ in data["loads"]}
        managed_loads_to_drop = managed_loads - selected_loads

        AvailabilityWindow.objects.filter(
            prof__user__username__in=managed_profs - selected_profs
        ).delete()

        for assignment in (
            Assignment.objects.filter(prof__user__username__in=managed_profs)
            .select_related("prof__user", "subject", "section")
            .all()
        ):
            key = (
                assignment.prof.user.username,
                assignment.subject.code,
                assignment.section.name,
            )
            if key in managed_loads_to_drop:
                assignment.delete()

        for code in managed_subjects - selected_subjects:
            subject = Subject.objects.filter(code=code).first()
            if subject and not Assignment.objects.filter(subject=subject).exists():
                subject.delete()

        for name in managed_sections - selected_sections:
            section = Section.objects.filter(name=name).first()
            if section and not Assignment.objects.filter(section=section).exists():
                section.delete()

        Room.objects.filter(name__in=managed_rooms - selected_rooms).delete()

    # -- HTTP + output -----------------------------------------------------

    def _http(self, base, method, path, payload=None, headers=None):
        url = base.rstrip("/") + path
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(
            url, data=data, method=method, headers=headers or {}
        )
        if data is not None:
            request.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode())

    def _print_result(self, algorithm, result):
        self.stdout.write(
            f"[{algorithm}] feasible={result['feasible']} "
            f"runtime_ms={result['runtime_ms']:.2f} "
            f"soft_score={result['soft_score']} classes={result['class_count']}"
        )

    def _print_comparison(self, results):
        self.stdout.write("\n=== comparison ===")
        self.stdout.write(f"{'algorithm':<14}{'feasible':<10}{'runtime_ms':<12}{'soft_score':<12}{'classes':<8}")
        for algorithm, r in results.items():
            self.stdout.write(
                f"{algorithm:<14}{str(r['feasible']):<10}"
                f"{r['runtime_ms']:.2f}{'':<6}{r['soft_score']!s:<12}{r['class_count']:<8}"
            )

    def _pick_best(self, results):
        feasible = [r for r in results.values() if r["feasible"]]
        if not feasible:
            return results[ALGORITHMS[0]]
        return min(feasible, key=lambda r: (r["soft_score"] is None, r["soft_score"]))

    def _time_range(self, c):
        start = c["start_time"][:5]
        end = c.get("end_time")
        return f"{start}-{end[:5]}" if end else start

    def _print_grid(self, algorithm, classes):
        self.stdout.write(f"\n=== {algorithm} weekly grid ===")
        by_day = {day: [] for day in range(6)}
        for c in classes:
            by_day[c["day"]].append(c)
        for day, day_classes in by_day.items():
            if not day_classes:
                continue
            self.stdout.write(f"\n{DAY_NAMES[day]}")
            for c in sorted(day_classes, key=lambda x: x["start_time"]):
                subject = c["subject_label"]
                if len(subject) > 20:
                    subject = subject[:17] + "..."
                mode = c.get("mode") or c.get("mode_display") or ""
                self.stdout.write(
                    f"  {self._time_range(c):<11}  {subject:<20}  "
                    f"{c['section_name']:<10}  {c['prof_name']:<16}  "
                    f"room {c['room_name']:<10}  {mode}"
                )
