import statistics
from collections import Counter, defaultdict

from django.db.models import Avg, Count, Q

from catalog.models import Department, Room, Section, Subject
from timetable.engines.scenario import DAY_NAMES, DEFAULT_DAY_RANGES
from timetable.models import (
    Assignment,
    AvailabilityWindow,
    ScheduledClass,
    ScheduleRun,
)
from users.models import Professors

from .conflicts import audit_conflicts


AVAILABLE_ROOM_HOURS = sum(
    (end - start) / 60.0 for start, end in DEFAULT_DAY_RANGES.values()
)


def _percentage(part, total):
    if not total:
        return 0.0
    return round(part / total * 100.0, 2)


def _mean(values):
    values = list(values)
    return round(sum(values) / len(values), 2) if values else 0.0


def _median(values):
    values = list(values)
    return round(statistics.median(values), 2) if values else 0.0


def _iso(value):
    return value.isoformat() if value else None


def _user_name(user):
    return user.get_full_name() or user.username


def _professor_name(prof):
    return _user_name(prof.user)


def _class_queryset(run):
    if run is None:
        return ScheduledClass.objects.none()
    return run.classes.select_related(
        "assignment__prof__user",
        "assignment__subject",
        "assignment__section",
        "room",
    )


def _assignment_queryset(term):
    if term is None:
        return Assignment.objects.none()
    return Assignment.objects.filter(term=term).select_related(
        "prof__user", "subject", "section"
    ).prefetch_related("meetings")


def term_meta(term):
    if term is None:
        return None
    return {
        "id": term.id,
        "code": term.code,
        "name": term.name,
        "year": term.year,
        "semester": term.semester,
        "is_active": term.is_active,
    }


def run_meta(run, class_count=None):
    if run is None:
        return None
    return {
        "id": run.id,
        "algorithm": run.algorithm,
        "status": run.status,
        "published": run.published,
        "runtime_ms": run.runtime_ms,
        "soft_score": run.soft_score,
        "created_at": _iso(run.created_at),
        "created_by": (
            run.created_by.username if run.created_by is not None else None
        ),
        "class_count": class_count,
    }


def context_meta(context, class_count=None):
    return {
        "term": term_meta(context.term),
        "run": run_meta(context.run, class_count=class_count),
        "selection": context.selection,
    }


def catalog_counts(term):
    data = {
        "departments": Department.objects.count(),
        "rooms": Room.objects.count(),
        "sections": Section.objects.count(),
        "subjects": Subject.objects.count(),
        "professors": Professors.objects.count(),
        "assignments": Assignment.objects.count(),
        "schedule_runs": ScheduleRun.objects.count(),
    }
    if term is not None:
        data["term"] = {
            "sections": Section.objects.filter(term=term).count(),
            "assignments": Assignment.objects.filter(term=term).count(),
            "schedule_runs": ScheduleRun.objects.filter(term=term).count(),
        }
    else:
        data["term"] = None
    return data


def calculate_coverage(assignments, classes):
    assignments = list(assignments)
    classes = list(classes)

    required = {}
    for assignment in assignments:
        meetings = list(assignment.meetings.all())
        required[assignment.id] = {
            "keys": Counter(
                (meeting.mode, meeting.duration_slots) for meeting in meetings
            ),
            "meetings": len(meetings),
            "hours": sum(meeting.duration_slots for meeting in meetings),
        }

    scheduled = defaultdict(Counter)
    for scheduled_class in classes:
        scheduled[scheduled_class.assignment_id][
            (scheduled_class.mode or "", scheduled_class.duration_slots)
        ] += 1

    rows = []
    totals = {
        "required_meetings": 0,
        "covered_meetings": 0,
        "required_hours": 0,
        "covered_hours": 0,
        "fully_covered": 0,
        "partially_covered": 0,
        "uncovered": 0,
        "no_meetings": 0,
    }

    for assignment in assignments:
        requirement = required[assignment.id]
        placed = scheduled[assignment.id]
        covered = sum(
            min(count, placed.get(key, 0))
            for key, count in requirement["keys"].items()
        )
        covered_hours = sum(
            min(count, placed.get(key, 0)) * key[1]
            for key, count in requirement["keys"].items()
        )
        missing = requirement["meetings"] - covered
        missing_hours = requirement["hours"] - covered_hours

        if requirement["meetings"] == 0:
            status = "no_meetings"
            totals["no_meetings"] += 1
        elif missing == 0:
            status = "full"
            totals["fully_covered"] += 1
        elif covered > 0:
            status = "partial"
            totals["partially_covered"] += 1
        else:
            status = "none"
            totals["uncovered"] += 1

        totals["required_meetings"] += requirement["meetings"]
        totals["covered_meetings"] += covered
        totals["required_hours"] += requirement["hours"]
        totals["covered_hours"] += covered_hours

        rows.append(
            {
                "assignment_id": assignment.id,
                "professor_id": assignment.prof_id,
                "professor": _professor_name(assignment.prof),
                "subject_id": assignment.subject_id,
                "subject": assignment.subject.code,
                "subject_title": assignment.subject.title,
                "section_id": assignment.section_id,
                "section": assignment.section.name,
                "required_meetings": requirement["meetings"],
                "covered_meetings": covered,
                "required_hours": requirement["hours"],
                "covered_hours": covered_hours,
                "missing_meetings": missing,
                "missing_hours": missing_hours,
                "coverage_pct": _percentage(covered, requirement["meetings"]),
                "status": status,
            }
        )

    summary = {
        "assignments": len(assignments),
        **totals,
        "coverage_pct": _percentage(
            totals["covered_meetings"], totals["required_meetings"]
        ),
        "hours_coverage_pct": _percentage(
            totals["covered_hours"], totals["required_hours"]
        ),
    }
    return {"summary": summary, "assignments": rows}


def build_workload(term, run, assignments=None, classes=None, department_id=None):
    assignments = list(
        _assignment_queryset(term) if assignments is None else assignments
    )
    classes = list(_class_queryset(run) if classes is None else classes)

    professors = Professors.objects.select_related("user", "department").all()
    if department_id is not None:
        professors = professors.filter(department_id=department_id)

    assignments_by_prof = defaultdict(list)
    for assignment in assignments:
        assignments_by_prof[assignment.prof_id].append(assignment)

    classes_by_prof = defaultdict(list)
    for scheduled_class in classes:
        classes_by_prof[scheduled_class.assignment.prof_id].append(scheduled_class)

    prof_ids = {prof.id for prof in professors}
    availability = defaultdict(list)
    for window in AvailabilityWindow.objects.filter(prof_id__in=prof_ids):
        availability[(window.prof_id, window.day)].append(
            (window.start_time, window.end_time, window.is_preferred)
        )

    rows = []
    for prof in professors:
        prof_classes = classes_by_prof.get(prof.id, [])
        daily_hours = [0] * 6
        for scheduled_class in prof_classes:
            daily_hours[scheduled_class.day] += scheduled_class.duration_slots

        longest = 0
        for day in range(6):
            day_classes = sorted(
                (item for item in prof_classes if item.day == day),
                key=lambda item: item.start_time,
            )
            intervals = []
            for item in day_classes:
                start = item.start_time.hour * 60 + item.start_time.minute
                end = start + item.duration_slots * 60
                if intervals and start <= intervals[-1][1]:
                    intervals[-1][1] = max(intervals[-1][1], end)
                else:
                    intervals.append([start, end])
            if intervals:
                longest = max(
                    longest, max(end - start for start, end in intervals) / 60
                )

        preferred_hours = 0
        non_preferred_hours = 0
        for scheduled_class in prof_classes:
            windows = availability.get(
                (prof.id, scheduled_class.day), []
            )
            is_preferred = any(
                start <= scheduled_class.start_time
                and scheduled_class.end_time <= end
                and preferred
                for start, end, preferred in windows
            )
            if is_preferred:
                preferred_hours += scheduled_class.duration_slots
            else:
                non_preferred_hours += scheduled_class.duration_slots

        prof_assignments = assignments_by_prof.get(prof.id, [])
        required_hours = sum(
            meeting.duration_slots
            for assignment in prof_assignments
            for meeting in assignment.meetings.all()
        )
        scheduled_hours = sum(item.duration_slots for item in prof_classes)
        mode_counts = Counter(item.mode or "unknown" for item in prof_classes)
        peak_daily = max(daily_hours, default=0)

        rows.append(
            {
                "professor_id": prof.id,
                "professor": _professor_name(prof),
                "username": prof.user.username,
                "department": prof.department.name if prof.department else None,
                "assignment_count": len(prof_assignments),
                "required_hours": required_hours,
                "scheduled_hours": scheduled_hours,
                "coverage_pct": _percentage(scheduled_hours, required_hours),
                "daily_hours": daily_hours,
                "peak_daily_hours": peak_daily,
                "active_days": sum(1 for value in daily_hours if value),
                "longest_consecutive_hours": round(longest, 2),
                "max_daily_hours": prof.max_daily_hours,
                "max_consecutive": prof.max_consecutive,
                "over_daily_limit": peak_daily > prof.max_daily_hours,
                "over_consecutive_limit": longest > prof.max_consecutive,
                "preferred_hours": preferred_hours,
                "non_preferred_hours": non_preferred_hours,
                "mode_counts": dict(mode_counts),
                "has_availability": any(
                    key[0] == prof.id for key in availability
                ),
            }
        )

    rows.sort(key=lambda row: (-row["scheduled_hours"], row["professor"]))
    scheduled_hours = [row["scheduled_hours"] for row in rows]

    summary = {
        "professors": len(rows),
        "professors_with_assignments": sum(
            1 for row in rows if row["assignment_count"]
        ),
        "professors_without_assignments": sum(
            1 for row in rows if not row["assignment_count"]
        ),
        "total_scheduled_hours": sum(scheduled_hours),
        "average_weekly_hours": _mean(scheduled_hours),
        "median_weekly_hours": _median(scheduled_hours),
        "overloaded_professors": sum(
            1
            for row in rows
            if row["over_daily_limit"] or row["over_consecutive_limit"]
        ),
        "over_daily_limit": sum(1 for row in rows if row["over_daily_limit"]),
        "over_consecutive_limit": sum(
            1 for row in rows if row["over_consecutive_limit"]
        ),
        "preferred_hours": sum(row["preferred_hours"] for row in rows),
        "non_preferred_hours": sum(row["non_preferred_hours"] for row in rows),
    }
    return {"summary": summary, "professors": rows}


def _heatmap(classes):
    occupied = Counter()
    for scheduled_class in classes:
        if scheduled_class.room_id is None:
            continue
        hour = scheduled_class.start_time.hour
        for offset in range(scheduled_class.duration_slots):
            occupied[(scheduled_class.day, hour + offset)] += 1

    cells = []
    for day, (start, end) in DEFAULT_DAY_RANGES.items():
        for hour in range(start // 60, end // 60):
            cells.append(
                {
                    "day": day,
                    "day_name": DAY_NAMES[day],
                    "hour": hour,
                    "hour_label": f"{hour:02d}:00",
                    "class_count": occupied.get((day, hour), 0),
                }
            )
    return cells


def build_rooms(
    run,
    classes=None,
    building=None,
    department_id=None,
):
    classes = list(_class_queryset(run) if classes is None else classes)
    rooms = Room.objects.select_related("department").all()
    if building:
        rooms = rooms.filter(building=building)
    if department_id is not None:
        rooms = rooms.filter(department_id=department_id)
    rooms = list(rooms)
    room_ids = {room.id for room in rooms}

    classes_by_room = defaultdict(list)
    for scheduled_class in classes:
        if scheduled_class.room_id in room_ids:
            classes_by_room[scheduled_class.room_id].append(scheduled_class)

    rows = []
    for room in rooms:
        room_classes = classes_by_room.get(room.id, [])
        scheduled_hours = sum(item.duration_slots for item in room_classes)
        over_capacity = sum(
            1
            for item in room_classes
            if item.assignment.section.headcount > room.capacity
        )
        capacity_ratios = [
            item.assignment.section.headcount / room.capacity * 100
            for item in room_classes
            if room.capacity
        ]
        rows.append(
            {
                "room_id": room.id,
                "room": room.name,
                "building": room.building,
                "department": room.department.name if room.department else None,
                "capacity": room.capacity,
                "class_count": len(room_classes),
                "scheduled_hours": scheduled_hours,
                "utilization_pct": _percentage(
                    scheduled_hours, AVAILABLE_ROOM_HOURS
                ),
                "capacity_utilization_pct": _mean(capacity_ratios),
                "over_capacity_sessions": over_capacity,
            }
        )

    rows.sort(key=lambda row: (-row["utilization_pct"], row["room"]))
    scheduled_hours = sum(row["scheduled_hours"] for row in rows)
    summary = {
        "rooms": len(rows),
        "used_rooms": sum(1 for row in rows if row["class_count"]),
        "unused_rooms": sum(1 for row in rows if not row["class_count"]),
        "total_scheduled_hours": scheduled_hours,
        "available_room_hours": len(rows) * AVAILABLE_ROOM_HOURS,
        "utilization_pct": _percentage(
            scheduled_hours, len(rows) * AVAILABLE_ROOM_HOURS
        ),
        "over_capacity_sessions": sum(
            row["over_capacity_sessions"] for row in rows
        ),
        "classes_without_room": sum(
            1 for item in classes if item.room_id is None
        ),
    }
    return {
        "summary": summary,
        "rooms": rows,
        "heatmap": _heatmap(
            [item for item in classes if item.room_id in room_ids]
        ),
    }


def build_sections(term, run, classes=None, program=None):
    assignments = list(_assignment_queryset(term))
    classes = list(_class_queryset(run) if classes is None else classes)
    coverage = calculate_coverage(assignments, classes)
    rows_by_section = defaultdict(list)
    for row in coverage["assignments"]:
        rows_by_section[row["section_id"]].append(row)

    sections = Section.objects.select_related("term").all()
    if term is not None:
        sections = sections.filter(term=term)
    if program:
        sections = sections.filter(program=program)

    rows = []
    for section in sections:
        section_rows = rows_by_section.get(section.id, [])
        required_meetings = sum(
            row["required_meetings"] for row in section_rows
        )
        covered_meetings = sum(row["covered_meetings"] for row in section_rows)
        required_hours = sum(row["required_hours"] for row in section_rows)
        covered_hours = sum(row["covered_hours"] for row in section_rows)
        if not section_rows or required_meetings == 0:
            status = "no_assignments"
        elif covered_meetings == required_meetings:
            status = "covered"
        elif covered_meetings:
            status = "partial"
        else:
            status = "uncovered"

        rows.append(
            {
                "section_id": section.id,
                "section": section.name,
                "program": section.program,
                "year_level": section.year_level,
                "headcount": section.headcount,
                "assignment_count": len(section_rows),
                "required_meetings": required_meetings,
                "covered_meetings": covered_meetings,
                "required_hours": required_hours,
                "covered_hours": covered_hours,
                "missing_hours": required_hours - covered_hours,
                "coverage_pct": _percentage(covered_meetings, required_meetings),
                "status": status,
            }
        )

    rows.sort(
        key=lambda row: (
            {"uncovered": 0, "partial": 1, "covered": 2, "no_assignments": 3}[
                row["status"]
            ],
            row["coverage_pct"],
            row["section"],
        )
    )
    summary = {
        "sections": len(rows),
        "covered": sum(1 for row in rows if row["status"] == "covered"),
        "partial": sum(1 for row in rows if row["status"] == "partial"),
        "uncovered": sum(1 for row in rows if row["status"] == "uncovered"),
        "no_assignments": sum(
            1 for row in rows if row["status"] == "no_assignments"
        ),
        "average_coverage_pct": _mean(row["coverage_pct"] for row in rows),
        "required_hours": sum(row["required_hours"] for row in rows),
        "covered_hours": sum(row["covered_hours"] for row in rows),
        "missing_hours": sum(row["missing_hours"] for row in rows),
    }
    return {"summary": summary, "sections": rows}


def _quality_row(run, selected_run, class_count):
    score_per_class = None
    if run.soft_score is not None and class_count:
        score_per_class = round(run.soft_score / class_count, 2)
    return {
        "run_id": run.id,
        "algorithm": run.algorithm,
        "status": run.status,
        "published": run.published,
        "created_at": _iso(run.created_at),
        "created_by": run.created_by.username if run.created_by else None,
        "runtime_ms": run.runtime_ms,
        "soft_score": run.soft_score,
        "soft_score_per_class": score_per_class,
        "class_count": class_count,
        "breakdown": run.breakdown,
        "selected": selected_run is not None and run.id == selected_run.id,
    }


def build_quality(
    term,
    selected_run,
    algorithm=None,
    status=None,
    date_from=None,
    date_to=None,
    limit=50,
    offset=0,
):
    runs = ScheduleRun.objects.select_related("term", "created_by")
    if term is not None:
        runs = runs.filter(term=term)
    if algorithm:
        runs = runs.filter(algorithm=algorithm)
    if status:
        runs = runs.filter(status=status)
    if date_from:
        runs = runs.filter(created_at__date__gte=date_from)
    if date_to:
        runs = runs.filter(created_at__date__lte=date_to)

    total = runs.count()
    page = list(
        runs.annotate(class_count=Count("classes")).order_by(
            "-created_at", "-id"
        )[offset : offset + limit]
    )

    rows = [
        _quality_row(run, selected_run, run.class_count) for run in page
    ]

    best_candidate = None
    best_score = None
    candidates = (
        runs.filter(
            status=ScheduleRun.Status.FEASIBLE,
            soft_score__isnull=False,
        )
        .annotate(class_count=Count("classes"))
        .filter(class_count__gt=0)
    )
    for candidate in candidates:
        comparable = candidate.soft_score / candidate.class_count
        if best_score is None or comparable < best_score:
            best_candidate = candidate
            best_score = comparable
    best_run = (
        _quality_row(
            best_candidate,
            selected_run,
            best_candidate.class_count,
        )
        if best_candidate is not None
        else None
    )

    aggregate = runs.aggregate(
        run_count=Count("id"),
        feasible_count=Count(
            "id", filter=Q(status=ScheduleRun.Status.FEASIBLE)
        ),
        average_runtime_ms=Avg("runtime_ms"),
        average_soft_score=Avg("soft_score"),
    )
    by_algorithm = list(
        runs.values("algorithm")
        .annotate(
            run_count=Count("id"),
            feasible_count=Count(
                "id", filter=Q(status=ScheduleRun.Status.FEASIBLE)
            ),
            average_runtime_ms=Avg("runtime_ms"),
            average_soft_score=Avg("soft_score"),
        )
        .order_by("-run_count", "algorithm")
    )
    for row in by_algorithm:
        row["feasible_rate"] = _percentage(
            row["feasible_count"], row["run_count"]
        )
        row["average_runtime_ms"] = round(row["average_runtime_ms"] or 0, 2)
        row["average_soft_score"] = (
            round(row["average_soft_score"], 2)
            if row["average_soft_score"] is not None
            else None
        )

    summary = {
        "run_count": aggregate["run_count"] or 0,
        "feasible_count": aggregate["feasible_count"] or 0,
        "feasible_rate": _percentage(
            aggregate["feasible_count"] or 0, aggregate["run_count"] or 0
        ),
        "average_runtime_ms": round(aggregate["average_runtime_ms"] or 0, 2),
        "average_soft_score": (
            round(aggregate["average_soft_score"], 2)
            if aggregate["average_soft_score"] is not None
            else None
        ),
        "best_run": best_run,
    }
    return {
        "summary": summary,
        "runs": rows,
        "by_algorithm": by_algorithm,
        "pagination": {"total": total, "limit": limit, "offset": offset},
    }


def selected_run_quality(run, class_count):
    if run is None:
        return None
    score_per_class = None
    if run.soft_score is not None and class_count:
        score_per_class = round(run.soft_score / class_count, 2)
    return {
        "run_id": run.id,
        "algorithm": run.algorithm,
        "status": run.status,
        "published": run.published,
        "runtime_ms": run.runtime_ms,
        "soft_score": run.soft_score,
        "soft_score_per_class": score_per_class,
        "class_count": class_count,
        "breakdown": run.breakdown,
    }


def build_overview(context):
    term = context.term
    run = context.run
    classes = list(_class_queryset(run))
    assignments = list(_assignment_queryset(term))
    coverage = calculate_coverage(assignments, classes)
    workload = build_workload(
        term, run, assignments=assignments, classes=classes
    )
    rooms = build_rooms(run, classes=classes)
    sections = build_sections(term, run, classes=classes)
    conflicts = audit_conflicts(classes)

    data = {
        "catalog": catalog_counts(term),
        "highlights": {
            "overloaded_professors": [
                row
                for row in workload["professors"]
                if row["over_daily_limit"] or row["over_consecutive_limit"]
            ][:5],
            "low_coverage_sections": [
                row
                for row in sections["sections"]
                if row["status"] in ("uncovered", "partial")
            ][:5],
            "underused_rooms": sorted(
                [
                    row
                    for row in rooms["rooms"]
                    if row["class_count"] == 0
                ],
                key=lambda row: row["room"],
            )[:5],
        },
    }
    summary = {
        "coverage": coverage["summary"],
        "quality": selected_run_quality(run, len(classes)),
        "workload": workload["summary"],
        "rooms": rooms["summary"],
        "sections": sections["summary"],
        "conflicts": conflicts["summary"],
    }
    return {"summary": summary, "data": data}
