from django.db import models


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

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Room(models.Model):
    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.name} (cap {self.capacity})"
