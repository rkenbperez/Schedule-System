from django.conf import settings
from django.db import models

from catalog.models import Room, Section, Subject
from users.models import Professors


def day_choices():
    return (
        ("Monday", "Monday"),
        ("Tuesday", "Tuesday"),
        ("Wednesday", "Wednesday"),
        ("Thursday", "Thursday"),
        ("Friday", "Friday"),
        ("Saturday", "Saturday"),
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
            )
        ]

    def __str__(self):
        return f"{self.prof} - {self.subject} - {self.section}"


class AvailabilityWindow(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="availability_windows",
    )
    day = models.CharField(max_length=20, choices=day_choices())
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_preferred = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.prof} {self.day} {self.start_time}-{self.end_time}"


class BusyBlock(models.Model):
    prof = models.ForeignKey(
        Professors,
        on_delete=models.CASCADE,
        related_name="busy_blocks",
    )
    day = models.CharField(max_length=20, choices=day_choices())
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.prof} {self.day} {self.start_time}-{self.end_time}"


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
    day = models.CharField(max_length=20, choices=day_choices())
    start_time = models.TimeField()
    duration_slots = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["day", "start_time"]

    def __str__(self):
        return f"{self.assignment} {self.day} {self.start_time}"
