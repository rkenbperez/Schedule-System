from collections import defaultdict
from itertools import combinations

from timetable.models import AvailabilityWindow


DETAIL_KEYS = (
    "room_conflicts",
    "professor_conflicts",
    "section_conflicts",
    "capacity_violations",
    "availability_violations",
    "consecutive_violations",
    "daily_hours_violations",
)

SUMMARY_KEYS = {
    "room_conflicts": "room",
    "professor_conflicts": "professor",
    "section_conflicts": "section",
    "capacity_violations": "capacity",
    "availability_violations": "availability",
    "consecutive_violations": "consecutive",
    "daily_hours_violations": "daily_hours",
}


def _time_minutes(value):
    return value.hour * 60 + value.minute


def _format_minutes(value):
    hour, minute = divmod(value, 60)
    return f"{hour:02d}:{minute:02d}"


def _start_minutes(scheduled_class):
    return _time_minutes(scheduled_class.start_time)


def _end_minutes(scheduled_class):
    return _start_minutes(scheduled_class) + scheduled_class.duration_slots * 60


def _overlaps(first, second):
    return _start_minutes(first) < _end_minutes(second) and _start_minutes(
        second
    ) < _end_minutes(first)


def _professor_label(prof):
    user = prof.user
    return user.get_full_name() or user.username


def _class_info(scheduled_class):
    assignment = scheduled_class.assignment
    return {
        "id": scheduled_class.id,
        "assignment_id": assignment.id,
        "subject": assignment.subject.code,
        "section": assignment.section.name,
        "professor": _professor_label(assignment.prof),
        "professor_id": assignment.prof_id,
        "mode": scheduled_class.mode,
        "day": scheduled_class.get_day_display(),
        "start_time": scheduled_class.start_time.strftime("%H:%M"),
        "end_time": scheduled_class.end_time.strftime("%H:%M"),
        "duration_slots": scheduled_class.duration_slots,
    }


def _overlap_info(first, second):
    start = max(_start_minutes(first), _start_minutes(second))
    end = min(_end_minutes(first), _end_minutes(second))
    return {
        "start_time": _format_minutes(start),
        "end_time": _format_minutes(end),
        "duration_minutes": end - start,
        "duration_slots": round((end - start) / 60, 2),
        "classes": [_class_info(first), _class_info(second)],
    }


def _focus_applies(focus_prof_id, *classes):
    if focus_prof_id is None:
        return True
    return any(c.assignment.prof_id == focus_prof_id for c in classes)


def _add_double_booking(details, bucket, entry, first):
    details[bucket].append((first.day, _start_minutes(first), entry))


def _sorted(details):
    for bucket, entries in details.items():
        details[bucket] = [
            entry for _day, _start, entry in sorted(entries, key=lambda row: row[:2])
        ]


def audit_conflicts(classes, availability_windows=None, focus_prof_id=None):
    classes = sorted(
        classes, key=lambda item: (item.day, item.start_time, item.id or 0)
    )
    details = {key: [] for key in DETAIL_KEYS}

    rooms = defaultdict(list)
    professors = defaultdict(list)
    sections = defaultdict(list)
    professor_days = defaultdict(list)

    for scheduled_class in classes:
        if scheduled_class.room_id is not None:
            rooms[(scheduled_class.room_id, scheduled_class.day)].append(
                scheduled_class
            )
        professors[
            (scheduled_class.assignment.prof_id, scheduled_class.day)
        ].append(scheduled_class)
        sections[
            (scheduled_class.assignment.section_id, scheduled_class.day)
        ].append(scheduled_class)
        professor_days[
            (scheduled_class.assignment.prof_id, scheduled_class.day)
        ].append(scheduled_class)

    for (room_id, _day), group in rooms.items():
        for first, second in combinations(group, 2):
            if not _overlaps(first, second):
                continue
            if not _focus_applies(focus_prof_id, first, second):
                continue
            entry = {
                "room": first.room.name,
                "room_id": room_id,
                "day": first.get_day_display(),
                **_overlap_info(first, second),
            }
            _add_double_booking(details, "room_conflicts", entry, first)

    for (prof_id, _day), group in professors.items():
        if focus_prof_id is not None and prof_id != focus_prof_id:
            continue
        for first, second in combinations(group, 2):
            if not _overlaps(first, second):
                continue
            entry = {
                "professor": _professor_label(first.assignment.prof),
                "professor_id": prof_id,
                "day": first.get_day_display(),
                **_overlap_info(first, second),
            }
            _add_double_booking(details, "professor_conflicts", entry, first)

    for (section_id, _day), group in sections.items():
        for first, second in combinations(group, 2):
            if not _overlaps(first, second):
                continue
            if not _focus_applies(focus_prof_id, first, second):
                continue
            entry = {
                "section": first.assignment.section.name,
                "section_id": section_id,
                "day": first.get_day_display(),
                **_overlap_info(first, second),
            }
            _add_double_booking(details, "section_conflicts", entry, first)

    for scheduled_class in classes:
        if focus_prof_id is not None:
            if scheduled_class.assignment.prof_id != focus_prof_id:
                continue
        if (
            scheduled_class.room
            and scheduled_class.assignment.section.headcount
            > scheduled_class.room.capacity
        ):
            details["capacity_violations"].append(
                (
                    scheduled_class.day,
                    _start_minutes(scheduled_class),
                    {
                        "class_id": scheduled_class.id,
                        "room": scheduled_class.room.name,
                        "capacity": scheduled_class.room.capacity,
                        "headcount": scheduled_class.assignment.section.headcount,
                        "subject": scheduled_class.assignment.subject.code,
                        "section": scheduled_class.assignment.section.name,
                        "professor": _professor_label(
                            scheduled_class.assignment.prof
                        ),
                        "day": scheduled_class.get_day_display(),
                        "start_time": scheduled_class.start_time.strftime("%H:%M"),
                    },
                )
            )

    if availability_windows is None:
        prof_ids = {scheduled_class.assignment.prof_id for scheduled_class in classes}
        if focus_prof_id is not None:
            prof_ids = {focus_prof_id}
        availability_windows = AvailabilityWindow.objects.filter(
            prof_id__in=prof_ids
        )

    availability = defaultdict(list)
    for window in availability_windows:
        availability[(window.prof_id, window.day)].append(
            (window.start_time, window.end_time)
        )

    for scheduled_class in classes:
        if focus_prof_id is not None:
            if scheduled_class.assignment.prof_id != focus_prof_id:
                continue
        key = (scheduled_class.assignment.prof_id, scheduled_class.day)
        windows = availability.get(key, [])
        if not windows:
            continue
        class_start = scheduled_class.start_time
        class_end = scheduled_class.end_time
        if any(start <= class_start and class_end <= end for start, end in windows):
            continue
        details["availability_violations"].append(
            (
                scheduled_class.day,
                _start_minutes(scheduled_class),
                {
                    "class_id": scheduled_class.id,
                    "professor": _professor_label(scheduled_class.assignment.prof),
                    "professor_id": scheduled_class.assignment.prof_id,
                    "subject": scheduled_class.assignment.subject.code,
                    "section": scheduled_class.assignment.section.name,
                    "day": scheduled_class.get_day_display(),
                    "class_time": (
                        f"{class_start.strftime('%H:%M')}-"
                        f"{class_end.strftime('%H:%M')}"
                    ),
                    "available_windows": [
                        f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}"
                        for start, end in windows
                    ],
                },
            )
        )

    for (prof_id, day), day_classes in professor_days.items():
        if focus_prof_id is not None and prof_id != focus_prof_id:
            continue
        prof = day_classes[0].assignment.prof
        day_classes.sort(key=lambda item: item.start_time)
        intervals = [
            (_start_minutes(item), _end_minutes(item), item) for item in day_classes
        ]
        merged = []
        for start, end, scheduled_class in intervals:
            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
                merged[-1][2].append(scheduled_class)
            else:
                merged.append([start, end, [scheduled_class]])
        if not merged:
            continue
        longest = max(merged, key=lambda item: item[1] - item[0])
        longest_minutes = longest[1] - longest[0]
        if longest_minutes > prof.max_consecutive * 60:
            details["consecutive_violations"].append(
                (
                    day,
                    longest[0],
                    {
                        "professor": _professor_label(prof),
                        "professor_id": prof_id,
                        "day": day_classes[0].get_day_display(),
                        "max_consecutive": prof.max_consecutive,
                        "actual_consecutive": round(longest_minutes / 60, 2),
                        "classes": [
                            {
                                "id": item.id,
                                "subject": item.assignment.subject.code,
                                "section": item.assignment.section.name,
                                "start": item.start_time.strftime("%H:%M"),
                                "end": item.end_time.strftime("%H:%M"),
                            }
                            for item in longest[2]
                        ],
                    },
                )
            )

        total_slots = sum(item.duration_slots for item in day_classes)
        if total_slots > prof.max_daily_hours:
            details["daily_hours_violations"].append(
                (
                    day,
                    _start_minutes(day_classes[0]),
                    {
                        "professor": _professor_label(prof),
                        "professor_id": prof_id,
                        "day": day_classes[0].get_day_display(),
                        "max_daily_hours": prof.max_daily_hours,
                        "actual_hours": total_slots,
                        "classes": [
                            {
                                "id": item.id,
                                "subject": item.assignment.subject.code,
                                "section": item.assignment.section.name,
                                "start": item.start_time.strftime("%H:%M"),
                                "end": item.end_time.strftime("%H:%M"),
                            }
                            for item in day_classes
                        ],
                    },
                )
            )

    _sorted(details)
    summary = {
        "total": sum(len(entries) for entries in details.values()),
        "by_type": {
            summary_key: len(details[detail_key])
            for detail_key, summary_key in SUMMARY_KEYS.items()
        },
        "double_bookings": (
            len(details["room_conflicts"])
            + len(details["professor_conflicts"])
            + len(details["section_conflicts"])
        ),
    }
    affected = set()
    for bucket in details.values():
        for entry in bucket:
            if "class_id" in entry:
                affected.add(entry["class_id"])
            for item in entry.get("classes", []):
                if "id" in item:
                    affected.add(item["id"])
    summary["affected_classes"] = len(affected)
    return {"details": details, "summary": summary}
