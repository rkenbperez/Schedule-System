from datetime import date
from django.core.management.base import BaseCommand
from timetable.models import AcademicTerm


class Command(BaseCommand):
    help = "Create First and Second Semester terms for the current year"

    def add_arguments(self, parser):
        parser.add_argument(
            "--year",
            type=int,
            default=date.today().year,
            help="Year for the terms (default: current year)",
        )
        parser.add_argument(
            "--activate-first",
            action="store_true",
            help="Set First Semester as active",
        )

    def handle(self, *args, **options):
        year = options["year"]
        activate_first = options["activate_first"]

        # Create First Semester
        first_sem, created = AcademicTerm.objects.get_or_create(
            year=year,
            semester=1,
            defaults={
                "start_date": date(year, 8, 1),
                "end_date": date(year, 12, 20),
                "is_active": activate_first,
            },
        )
        if created:
            self.stdout.write(f"Created: {first_sem}")
        else:
            if activate_first:
                first_sem.is_active = True
                first_sem.save()
            self.stdout.write(f"Exists: {first_sem}")

        # Create Second Semester
        second_sem, created = AcademicTerm.objects.get_or_create(
            year=year,
            semester=2,
            defaults={
                "start_date": date(year + 1, 1, 15),
                "end_date": date(year + 1, 5, 30),
                "is_active": False,
            },
        )
        if created:
            self.stdout.write(f"Created: {second_sem}")
        else:
            self.stdout.write(f"Exists: {second_sem}")

        # Ensure only one is active
        if activate_first:
            AcademicTerm.objects.exclude(pk=first_sem.pk).update(is_active=False)
            self.stdout.write("Set First Semester as active")

        self.stdout.write(self.style.SUCCESS("Done"))