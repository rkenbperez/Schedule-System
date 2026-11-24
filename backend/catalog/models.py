import re

from django.db import models


def program_from_name(name):
    """Derive a program code ('BSCS') from a section name ('BSCS 3-A')."""
    match = re.match(r"^([A-Za-z]+)", name or "")
    return match.group(1) if match else ""


class Subject(models.Model):
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200)
    units = models.PositiveSmallIntegerField(default=3)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.title}"


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


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Room(models.Model):
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

    def __str__(self):
        return f"{self.name} (cap {self.capacity})"
