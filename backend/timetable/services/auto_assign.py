from django.db import transaction
from django.db.models import Sum

from catalog.models import ProfessorSubject, SectionSubject

from ..models import Assignment, AvailabilityWindow, MeetingSlot


def _subject_hours(subject):
    lec_hours = subject.lec_hours or 0
    lab_hours = subject.lab_hours or 0
    if lec_hours <= 0 and lab_hours <= 0:
        lec_hours = subject.units or 0
    if lec_hours <= 0 and lab_hours <= 0:
        lec_hours = 1
    return lec_hours, lab_hours


def _term_loads(term):
    rows = (
        MeetingSlot.objects.filter(assignment__term=term)
        .values("assignment__prof_id")
        .annotate(hours=Sum("duration_slots"))
    )
    return {row["assignment__prof_id"]: row["hours"] or 0 for row in rows}


def _qualified_professors(requirement, loads):
    available_prof_ids = set(
        AvailabilityWindow.objects.values_list("prof_id", flat=True).distinct()
    )
    qualifications = (
        ProfessorSubject.objects.filter(
            subject=requirement.subject,
            professor__user__is_active=True,
        )
        .select_related("professor__user", "professor__department")
        .order_by("professor_id")
    )

    candidates = []
    for qualification in qualifications:
        professor = qualification.professor
        if professor.id not in available_prof_ids:
            continue
        weekly_cap = (professor.max_daily_hours or 8) * 5
        assigned_hours = loads.get(professor.id, 0)
        if assigned_hours >= weekly_cap:
            continue
        score = _score_professor(qualification, requirement, loads)
        candidates.append(
            (-score, assigned_hours, professor.id, professor)
        )

    candidates.sort()
    return candidates


def _pick_candidate(candidates, loads, needed_hours):
    for _, _, _, professor in candidates:
        weekly_cap = (professor.max_daily_hours or 8) * 5
        if loads.get(professor.id, 0) + needed_hours <= weekly_cap:
            return professor
    return None


def _score_professor(qualification, requirement, loads):
    professor = qualification.professor
    score = 50 if qualification.is_preferred else 0

    department = professor.department
    program = requirement.section.program
    if department and program and department.name.casefold() == program.casefold():
        score += 10

    weekly_cap = (professor.max_daily_hours or 8) * 5
    if weekly_cap:
        load_ratio = loads.get(professor.id, 0) / weekly_cap
        score += max(0, int((1 - load_ratio) * 10))

    return score


@transaction.atomic
def auto_assign_professors(term, replace_auto=False):
    if replace_auto:
        Assignment.objects.filter(
            term=term,
            source=Assignment.Source.AUTO,
        ).delete()

    existing_keys = set(
        Assignment.objects.filter(term=term).values_list("section_id", "subject_id")
    )
    requirements = (
        SectionSubject.objects.filter(section__term=term)
        .select_related("section", "subject")
        .order_by("section_id", "subject__code")
    )
    loads = _term_loads(term)

    created = []
    skipped = 0
    unassigned = []

    for requirement in requirements:
        key = (requirement.section_id, requirement.subject_id)
        if key in existing_keys:
            skipped += 1
            continue

        lec_hours, lab_hours = _subject_hours(requirement.subject)
        needed_hours = lec_hours + lab_hours
        candidates = _qualified_professors(requirement, loads)
        professor = _pick_candidate(candidates, loads, needed_hours)

        if professor is None:
            unassigned.append(
                {
                    "section_id": requirement.section_id,
                    "section_name": requirement.section.name,
                    "subject_id": requirement.subject_id,
                    "subject_code": requirement.subject.code,
                    "subject_title": requirement.subject.title,
                    "reason": "No qualified professor with availability and capacity.",
                }
            )
            continue

        assignment = Assignment.objects.create(
            prof=professor,
            subject=requirement.subject,
            section=requirement.section,
            term=term,
            source=Assignment.Source.AUTO,
        )

        slots = []
        order = 1
        if lec_hours > 0:
            slots.append(
                MeetingSlot(
                    assignment=assignment,
                    order=order,
                    mode=MeetingSlot.Mode.SYNC,
                    duration_slots=lec_hours,
                )
            )
            order += 1
        if lab_hours > 0:
            slots.append(
                MeetingSlot(
                    assignment=assignment,
                    order=order,
                    mode=MeetingSlot.Mode.LAB,
                    duration_slots=lab_hours,
                )
            )
        MeetingSlot.objects.bulk_create(slots)

        loads[professor.id] = loads.get(professor.id, 0) + needed_hours
        existing_keys.add(key)
        created.append(
            {
                "assignment_id": assignment.id,
                "professor_id": professor.id,
                "professor_name": str(professor),
                "section_id": requirement.section_id,
                "section_name": requirement.section.name,
                "subject_id": requirement.subject_id,
                "subject_code": requirement.subject.code,
                "subject_title": requirement.subject.title,
                "lec_hours": lec_hours,
                "lab_hours": lab_hours,
            }
        )

    return {
        "created": created,
        "created_count": len(created),
        "skipped": skipped,
        "unassigned": unassigned,
        "unassigned_count": len(unassigned),
    }
