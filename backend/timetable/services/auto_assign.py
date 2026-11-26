from collections import defaultdict
from django.db import transaction
from django.db.models import Sum, Q

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


def _day_loads(term):
    """Get professor loads per day for load balancing."""
    from ..models import ScheduledClass
    
    rows = (
        ScheduledClass.objects.filter(term=term)
        .values("assignment__prof_id", "day")
        .annotate(hours=Sum("duration_slots"))
    )
    loads = defaultdict(lambda: defaultdict(int))
    for row in rows:
        prof_id = row["assignment__prof_id"]
        day = row["day"]
        loads[prof_id][day] = row["hours"] or 0
    return loads


def _get_professor_availability(term):
    """Get availability windows for professors with assignments in term."""
    windows = AvailabilityWindow.objects.filter(
        prof__assignments__term=term
    ).distinct().select_related("prof")
    
    availability = defaultdict(lambda: defaultdict(list))
    for window in windows:
        prof_id = window.prof_id
        availability[prof_id][window.day].append({
            'start': window.start_time,
            'end': window.end_time,
            'is_preferred': window.is_preferred,
        })
    return availability


def _has_availability_for(prof_availability, day, start_hour, duration_hours):
    """Check if professor has availability covering the time slot."""
    if day not in prof_availability:
        return False
    end_hour = start_hour + duration_hours
    for window in prof_availability.get(day, []):
        start_min = window['start'].hour * 60 + window['start'].minute
        end_min = window['end'].hour * 60 + window['end'].minute
        if start_min <= start_hour * 60 and end_min >= (start_hour + duration_hours) * 60:
            return True
    return False


def _professor_daily_load(day_loads, prof_id, day):
    """Get professor's load for a specific day."""
    return day_loads.get(prof_id, {}).get(day, 0)


def _would_exceed_consecutive(day_loads, prof_id, day, start_hour, duration_hours):
    """Check if placing a meeting would exceed max consecutive hours."""
    # This is a simplified check - in practice we'd need the full schedule
    # For now, we use daily load as a proxy
    daily_load = _professor_daily_load({}, None, None)  # placeholder
    return False  # Simplified - would need full schedule


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
    
    # Pre-compute loads and availability
    loads = _term_loads(term)
    day_loads = _day_loads(term)
    prof_availability = _get_professor_availability(term)
    
    # Get all qualified professors with their qualifications
    qualifications = ProfessorSubject.objects.filter(
        professor__user__is_active=True,
    ).select_related("professor__user", "professor__department", "subject")
    
    # Build qualification index
    qual_by_subject = defaultdict(list)
    for qual in qualifications:
        qual_by_subject[qual.subject_id].append(qual)
    
    # Get available professor IDs
    available_prof_ids = set(
        AvailabilityWindow.objects.values_list("prof_id", flat=True).distinct()
    )
    
    existing_keys = set(
        Assignment.objects.filter(term=term).values_list("section_id", "subject_id")
    )
    requirements_list = (
        SectionSubject.objects.filter(section__term=term)
        .select_related("section", "subject", "section__term")
        .order_by("section_id", "subject__code")
    )
    
    loads = _term_loads(term)
    day_loads = _day_loads(term)
    prof_availability = _get_professor_availability(term)
    
    created = []
    skipped = 0
    unassigned = []

    for requirement in requirements_list:
        key = (requirement.section_id, requirement.subject_id)
        if key in existing_keys:
            skipped += 1
            continue

        lec_hours, lab_hours = _subject_hours(requirement.subject)
        needed_hours = lec_hours + lab_hours
        
        # Get qualified professors for this subject
        qualified_quals = qual_by_subject.get(requirement.subject_id, [])
        
        # Filter and score candidates
        candidates = []
        for qual in qualified_quals:
            professor = qual.professor
            
            # Check availability
            if professor.id not in available_prof_ids:
                continue
            
            # Check weekly capacity
            weekly_cap = (professor.max_daily_hours or 8) * 5
            if loads.get(professor.id, 0) + (lec_hours + lab_hours) > weekly_cap:
                continue
            
            # Check if professor has availability windows
            if professor.id not in prof_availability:
                continue
            
            # Score the professor
            score = _score_professor(
                qual, requirement, professor, loads, 
                _get_professor_availability(requirement.term)  # placeholder
            )
            
            candidates.append((-score, professor.id, qual, professor))
        
        # Sort by score (highest first)
        candidates.sort()
        
        # Pick best candidate that fits
        professor = None
        for _, _, qual, prof in candidates:
            if loads.get(prof.id, 0) + (lec_hours + lab_hours) <= (prof.max_daily_hours or 8) * 5:
                professor = prof
                break
        
        if professor is None:
            unassigned.append({
                "section_id": requirement.section_id,
                "section_name": requirement.section.name,
                "subject_id": requirement.subject_id,
                "subject_code": requirement.subject.code,
                "subject_title": requirement.subject.title,
                "reason": "No qualified professor with availability and capacity.",
            })
            continue

        assignment = Assignment.objects.create(
            prof=professor,
            subject=requirement.subject,
            section=requirement.section,
            term=requirement.term,
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

        loads[professor.id] = loads.get(professor.id, 0) + lec_hours + lab_hours
        existing_keys.add(key)
        created.append({
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
        })

    return {
        "created": created,
        "created_count": len(created),
        "skipped": skipped,
        "unassigned": unassigned,
        "unassigned_count": len(unassigned),
    }


def _score_professor(qual, requirement, professor, loads, prof_availability):
    """Score a professor for a requirement. Higher is better."""
    score = 0
    
    # Preferred qualification (50 pts)
    if qual.is_preferred:
        score += 50
    
    # Same department as section (10 pts)
    if professor.department_id and professor.department_id == requirement.section.program:
        score += 10
    
    # Load balancing: prefer lighter load (max 10 pts)
    current_load = loads.get(professor.id, 0)
    weekly_cap = (professor.max_daily_hours or 8) * 5
    if weekly_cap > 0:
        load_ratio = loads.get(professor.id, 0) / weekly_cap
        score += int((1 - load_ratio) * 10)
    
    # Availability bonus (5 pts) - simplified check
    # if professor.id in prof_availability and prof_availability[professor.id]:
    #     score += 5
    
    # Consecutive penalty would go here
    # if _would_exceed_consecutive(...):
    #     score -= 20
    
    return score