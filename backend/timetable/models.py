from django.conf import settings
from django.db import models

from catalog.models import Room, Section, Subject
from users.models import Professors


WEEKDAY_CHOICES = (
    (0, "Monday"),
    (1, "Tuesday"),
    (2, "Wednesday"),
    (3, "Thursday"),
    (4, "Friday"),
    (5, "Saturday"),
)


class Assignment(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    meetings_per_week = models.PositiveSmallIntegerField(default=1)
    duration_slots = models.PositiveSmallIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["prof", "subject", "section"],
                name="unique_prof_subject_section",
            ),
            models.CheckConstraint(
                condition=models.Q(meetings_per_week__gte=1),
                name="assignment_meetings_per_week_gte_1",
            ),
            models.CheckConstraint(
                condition=models.Q(duration_slots__gte=1),
                name="assignment_duration_slots_gte_1",
            ),
        ]

    def __str__(self):
        return f"{self.prof} - {self.subject} - {self.section}"


class AvailabilityWindow(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="availability_windows",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_preferred = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="availability_start_before_end",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="availability_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.prof} {self.get_day_display()} {self.start_time}-{self.end_time}"


class BusyBlock(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="busy_blocks",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="busyblock_start_before_end",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="busyblock_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.prof} {self.get_day_display()} {self.start_time}-{self.end_time}"


class ScheduleRun(models.Model):
    class Status(models.TextChoices):
        FEASIBLE = "feasible", "Feasible"
        INFEASIBLE = "infeasible", "Infeasible"

    algorithm = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices)
    runtime_ms = models.FloatField(default=0.0)
    soft_score = models.FloatField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.algorithm} {self.status} ({self.created_at:%Y-%m-%d %H:%M})"


class ScheduledClass(models.Model):
    run = models.ForeignKey(
        ScheduleRun,
        on_delete=models.CASCADE,
        related_name="classes",
    )
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="scheduled_classes",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_classes",
    )
    day = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    duration_slots = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["day", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_slots__gte=1),
                name="scheduled_class_duration_slots_gte_1",
            ),
            models.CheckConstraint(
                condition=models.Q(day__gte=0, day__lte=5),
                name="scheduled_class_day_in_range",
            ),
        ]

    def __str__(self):
        return f"{self.assignment} {self.get_day_display()} {self.start_time}"
