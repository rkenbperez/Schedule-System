import re

from django.conf import settings
from django.db import models


def program_from_name(name):
    """Derive a program code ('BSCS') from a section name ('BSCS 3-A')."""
    match = re.match(r"^([A-Za-z]+)", name or "")
    return match.group(1) if match else ""


class Subject(models.Model):
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200)
    units = models.PositiveSmallIntegerField(default=3)
    lec_hours = models.PositiveSmallIntegerField(default=0)
    lab_hours = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.title}"


class ProfessorSubject(models.Model):
    professor = models.ForeignKey(
        "users.Professors",
        on_delete=models.CASCADE,
        related_name="qualified_subjects",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="qualified_professors",
    )
    is_preferred = models.BooleanField(default=False)

    class Meta:
        ordering = ["professor_id", "subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["professor", "subject"],
                name="unique_professor_subject",
            )
        ]

    def __str__(self):
        return f"{self.professor} - {self.subject}"


class Section(models.Model):
    name = models.CharField(max_length=50, unique=True)
    headcount = models.PositiveIntegerField()
    program = models.CharField(max_length=20, blank=True, default="")  # e.g., "BSIT", "BSCS"
    year_level = models.PositiveSmallIntegerField(default=1)
    term = models.ForeignKey(
        "timetable.AcademicTerm",
        on_delete=models.CASCADE,
        related_name="sections",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.program:
            self.program = program_from_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class SectionSubject(models.Model):
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="subject_requirements",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="section_requirements",
    )

    class Meta:
        ordering = ["section_id", "subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "subject"],
                name="unique_section_subject",
            )
        ]

    def __str__(self):
        return f"{self.section} - {self.subject}"


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="headed_departments",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Room(models.Model):
    class RoomType(models.TextChoices):
        LECTURE = "lecture", "Lecture"
        LABORATORY = "laboratory", "Laboratory"
        GENERAL = "general", "General"

    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rooms",
    )
    building = models.CharField(max_length=100, blank=True, default="")
    room_type = models.CharField(
        max_length=20,
        choices=RoomType.choices,
        default=RoomType.GENERAL,
    )

    def __str__(self):
        return f"{self.name} (cap {self.capacity})"
