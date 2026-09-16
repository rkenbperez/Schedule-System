import factory
from factory.django import DjangoModelFactory
from datetime import timedelta
from django.utils import timezone

from catalog.models import Department, Room, Section, Subject
from users.models import Professors
from timetable.models import (
    Assignment, AvailabilityWindow, BusyBlock,
    MeetingSlot, ScheduledClass, ScheduleRun
)
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
    username = factory.Sequence(lambda n: f"user{n}")
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')
    is_staff = False


class RegistrarFactory(UserFactory):
    is_staff = True
    username = factory.Sequence(lambda n: f"reg{n}")


class ProfessorUserFactory(UserFactory):
    username = factory.Sequence(lambda n: f"prof{n}")


class DepartmentFactory(DjangoModelFactory):
    class Meta:
        model = Department
    name = factory.Sequence(lambda n: f"DEPT{n}")


class RoomFactory(DjangoModelFactory):
    class Meta:
        model = Room
    name = factory.Sequence(lambda n: f"R{n:03d}")
    capacity = factory.Iterator([30, 40, 45, 50, 60])
    department = factory.SubFactory(DepartmentFactory)


class SectionFactory(DjangoModelFactory):
    class Meta:
        model = Section
    name = factory.Sequence(lambda n: f"SEC{n:03d}")
    headcount = factory.Iterator([25, 30, 35, 40])


class SubjectFactory(DjangoModelFactory):
    class Meta:
        model = Subject
    code = factory.Sequence(lambda n: f"SUB{n:03d}")
    title = factory.Sequence(lambda n: f"Subject {n}")
    units = 3





class ProfessorFactory(DjangoModelFactory):
    class Meta:
        model = Professors
    user = factory.SubFactory(ProfessorUserFactory)
    department = factory.SubFactory(DepartmentFactory)
    max_daily_hours = 8
    max_consecutive = 4


class AssignmentFactory(DjangoModelFactory):
    class Meta:
        model = Assignment
    prof = factory.SubFactory(ProfessorFactory)
    subject = factory.SubFactory(SubjectFactory)
    section = factory.SubFactory(SectionFactory)


class MeetingSlotFactory(DjangoModelFactory):
    class Meta:
        model = MeetingSlot
    assignment = factory.SubFactory(AssignmentFactory)
    order = factory.Sequence(lambda n: n)
    mode = factory.Iterator(["sync", "async", "lab"])
    duration_slots = factory.LazyAttribute(lambda o: {"sync": 2, "async": 1, "lab": 3}[o.mode])


class AvailabilityWindowFactory(DjangoModelFactory):
    class Meta:
        model = AvailabilityWindow
    prof = factory.SubFactory(ProfessorFactory)
    day = factory.Iterator(range(5))
    start_time = factory.LazyFunction(lambda: timezone.datetime.strptime("08:00", "%H:%M").time())
    end_time = factory.LazyFunction(lambda: timezone.datetime.strptime("17:00", "%H:%M").time())
    is_preferred = True


class BusyBlockFactory(DjangoModelFactory):
    class Meta:
        model = BusyBlock
    prof = factory.SubFactory(ProfessorFactory)
    day = factory.Iterator(range(5))
    start_time = factory.LazyFunction(lambda: timezone.datetime.strptime("12:00", "%H:%M").time())
    end_time = factory.LazyFunction(lambda: timezone.datetime.strptime("13:00", "%H:%M").time())