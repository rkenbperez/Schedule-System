from datetime import date, datetime, timedelta

from django.db import transaction

from apps.rooms.models import Room
from apps.scheduling.models import Schedule


class NoAvailableRoom(Exception):
    """Raised when no conflict-free room/time slot can be found."""


@transaction.atomic
def create_schedule(
    assignment,
    component,
    start_time,
    day_of_week
):
    section = assignment.section
    teacher = assignment.teacher
    term = assignment.academic_term
    duration = component.duration
    room_type = component.room_type

    new_end_time = (
        datetime.combine(date.today(), start_time)
        + timedelta(hours=duration)
    ).time()

    existing_schedules = Schedule.objects.filter(
        academic_term=term,
        is_active=True,
    )

    rooms = Room.objects.filter(
        room_type=room_type,
        is_active=True,
        capacity__gte=section.student_count,
    )

    teacher_schedules = existing_schedules.filter(teacher=teacher)
    section_schedules = existing_schedules.filter(section=section)

    def overlaps(base):
        return base.filter(
            day_of_week=day_of_week,
            end_time__gt=start_time,
            start_time__lt=new_end_time,
        ).exists()

    for room in rooms:
        room_conflict = overlaps(existing_schedules.filter(room=room))
        teacher_conflict = overlaps(teacher_schedules)
        section_conflict = overlaps(section_schedules)

        if room_conflict or teacher_conflict or section_conflict:
            continue

        return Schedule.objects.create(
            course_assignment=assignment,
            course_component=component,
            academic_term=term,
            teacher=teacher,
            section=section,
            room=room,
            start_time=start_time,
            end_time=new_end_time,
            day_of_week=day_of_week,
        )

    raise NoAvailableRoom(
        'No conflict-free room is available for the requested slot.'
    )