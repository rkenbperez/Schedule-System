"""Run the full schedule-creation flow against the live dev server.

Seeds a small, idempotent demo dataset (a registrar, 3 professors, subjects,
sections, rooms, assignments and availability), then logs in over real HTTP,
generates a schedule with all three engines, and prints a metrics comparison
plus a readable Monday-Saturday grid for the best-scoring feasible result.

Usage (two terminals):

    # terminal 1
    python manage.py runserver

    # terminal 2
    python manage.py demo_schedule
"""

import json
import urllib.error
import urllib.request

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from catalog.models import Room, Section, Subject
from timetable.models import Assignment, AvailabilityWindow
from users.models import Professors

User = get_user_model()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
DEMO_PASSWORD = "demo12345"
ALGORITHMS = ["greedy", "min_conflicts", "backtracking"]


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

        registrar = self._seed_users()
        self._seed_catalog()
        self._seed_load_and_availability()

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

    def _seed_users(self):
        registrar, created = User.objects.get_or_create(username="demoreg")
        if created:
            registrar.is_staff = True
            registrar.set_password(DEMO_PASSWORD)
            registrar.save()

        profs = [
            ("demo_prof1", "CS"),
            ("demo_prof2", "IT"),
            ("demo_prof3", "MATH"),
        ]
        for username, department in profs:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            Professors.objects.get_or_create(user=user, defaults={"department": department})

        return registrar

    def _seed_catalog(self):
        for code, title in [
            ("CC101", "Programming Fundamentals"),
            ("CC102", "Database Systems"),
            ("CC103", "Networking"),
        ]:
            Subject.objects.get_or_create(code=code, defaults={"title": title, "units": 3})

        for name, headcount in [
            ("BSIT-3A", 30),
            ("BSIT-3B", 25),
            ("BSCS-2A", 28),
        ]:
            Section.objects.get_or_create(name=name, defaults={"headcount": headcount})

        for name, capacity in [("R201", 40), ("R202", 40), ("LAB1", 30)]:
            Room.objects.get_or_create(name=name, defaults={"capacity": capacity})

    def _seed_load_and_availability(self):
        def prof(username):
            return Professors.objects.get(user__username=username)

        def subject(code):
            return Subject.objects.get(code=code)

        def section(name):
            return Section.objects.get(name=name)

        loads = [
            ("demo_prof1", "CC101", "BSIT-3A", 2, 1),
            ("demo_prof1", "CC102", "BSCS-2A", 1, 2),
            ("demo_prof2", "CC102", "BSIT-3B", 2, 1),
            ("demo_prof3", "CC103", "BSIT-3A", 2, 1),
            ("demo_prof3", "CC101", "BSIT-3B", 1, 2),
        ]
        for username, code, sec_name, meetings, duration in loads:
            Assignment.objects.update_or_create(
                prof=prof(username),
                subject=subject(code),
                section=section(sec_name),
                defaults={"meetings_per_week": meetings, "duration_slots": duration},
            )

        for username in ("demo_prof1", "demo_prof2", "demo_prof3"):
            p = prof(username)
            for day in range(5):
                AvailabilityWindow.objects.update_or_create(
                    prof=p,
                    day=day,
                    defaults={
                        "start_time": "07:00:00",
                        "end_time": "19:00:00",
                        "is_preferred": True,
                    },
                )

    def _reset(self):
        from timetable.models import ScheduledClass, ScheduleRun

        ScheduledClass.objects.all().delete()
        ScheduleRun.objects.all().delete()
        Assignment.objects.all().delete()
        AvailabilityWindow.objects.all().delete()

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
                self.stdout.write(
                    f"  {c['start_time'][:5]}  {subject:<20}  "
                    f"{c['section_name']:<10}  {c['prof_name']:<16}  "
                    f"room {c['room_name']}"
                )
