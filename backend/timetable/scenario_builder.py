"""Build an engines Scenario from Django ORM rows.

This is the only Django-touching piece of the solver. It stays out of the
``engines`` package so that package remains importable without a database.
"""

from catalog.models import Room
from users.models import Professors

from .engines.scenario import Availability, Busy, Meeting, RoomRef, Scenario
from .models import Assignment, AvailabilityWindow, BusyBlock


def _to_minutes(value):
    return value.hour * 60 + value.minute


def build_scenario() -> Scenario:
    rooms = [
        RoomRef(id=r.pk, name=r.name, capacity=r.capacity)
        for r in Room.objects.all()
    ]

    meetings = []
    meeting_id = 1
    for assignment in Assignment.objects.select_related("prof", "subject", "section"):
        headcount = assignment.section.headcount
        for _ in range(assignment.meetings_per_week):
            meetings.append(
                Meeting(
                    meeting_id=meeting_id,
                    assignment_id=assignment.pk,
                    prof_id=assignment.prof_id,
                    prof_label=str(assignment.prof),
                    subject_label=str(assignment.subject),
                    section_id=assignment.section_id,
                    section_name=assignment.section.name,
                    section_headcount=headcount,
                    duration_slots=assignment.duration_slots,
                )
            )
            meeting_id += 1

    availability = [
        Availability(
            prof_id=window.prof_id,
            day=window.day,
            start=_to_minutes(window.start_time),
            end=_to_minutes(window.end_time),
            is_preferred=window.is_preferred,
        )
        for window in AvailabilityWindow.objects.all()
    ]

    busy = [
        Busy(
            prof_id=block.prof_id,
            day=block.day,
            start=_to_minutes(block.start_time),
            end=_to_minutes(block.end_time),
        )
        for block in BusyBlock.objects.all()
    ]

    prof_daily_hours = {
        prof.pk: prof.max_daily_hours for prof in Professors.objects.all()
    }

    return Scenario(
        rooms=rooms,
        meetings=meetings,
        availability=availability,
        busy=busy,
        prof_daily_hours=prof_daily_hours,
    )
