"""Feasibility pre-check utility for schedule generation."""

from collections import defaultdict
from typing import Dict, List, Any

from catalog.models import Room, Section, Subject
from timetable.models import (
    AcademicTerm, Assignment, AvailabilityWindow, MeetingSlot, Professors
)
from users.models import Professors as ProfessorsModel


def _get_meeting_counts(term: AcademicTerm) -> Dict[str, int]:
    """Count meetings by mode for the given term."""
    assignments = Assignment.objects.filter(term=term).select_related(
        'prof', 'subject', 'section'
    ).prefetch_related('meetings')
    
    counts = {'lab': 0, 'sync': 0, 'async': 0, 'total': 0}
    for assignment in assignments:
        for slot in assignment.meetings.all():
            counts[slot.mode] = counts.get(slot.mode, 0) + 1
            counts['total'] += 1
    return counts


def _get_room_counts() -> Dict[str, int]:
    """Count rooms by type."""
    rooms = Room.objects.all()
    counts = {'laboratory': 0, 'lecture': 0, 'general': 0, 'total': 0}
    for room in rooms:
        counts[room.room_type] = counts.get(room.room_type, 0) + 1
        counts['total'] += 1
    return counts


def _get_professor_loads(term: AcademicTerm) -> Dict[int, Dict[str, Any]]:
    """Get current professor loads for the term."""
    loads = defaultdict(lambda: {
        'weekly_hours': 0,
        'daily_hours': defaultdict(int),
        'max_daily': 8,
        'max_consecutive': 4,
        'department': None,
        'availability_windows': defaultdict(list),
    })
    
    # Get professors with assignments in this term
    profs = ProfessorsModel.objects.filter(
        assignments__term=term
    ).distinct().select_related('department')
    
    for prof in profs:
        loads[prof.id]['max_daily'] = prof.max_daily_hours or 8
        loads[prof.id]['max_consecutive'] = prof.max_consecutive or 4
        loads[prof.id]['department'] = prof.department_id
    
    # Add assignment hours
    assignments = Assignment.objects.filter(term=term).select_related(
        'prof', 'section'
    ).prefetch_related('meetings')
    
    for assignment in assignments:
        prof_id = assignment.prof_id
        for slot in assignment.meetings.all():
            duration = slot.duration_slots  # hours (1 slot = 1 hour)
            loads[prof_id]['weekly_hours'] += duration
            # We'll estimate daily distribution later
    
    # Add availability windows
    windows = AvailabilityWindow.objects.filter(
        prof__assignments__term=term
    ).distinct()
    
    for window in windows:
        prof_id = window.prof_id
        loads[prof_id]['availability_windows'][window.day].append({
            'start': window.start_time,
            'end': window.end_time,
            'is_preferred': window.is_preferred,
        })
    
    return dict(loads)


def _get_room_capacities_by_type() -> Dict[str, List[int]]:
    """Get room capacities grouped by type."""
    capacities = defaultdict(list)
    for room in Room.objects.all():
        capacities[room.room_type].append(room.capacity)
    return {k: sorted(v, reverse=True) for k, v in capacities.items()}


def _get_section_requirements(term: AcademicTerm) -> List[Dict[str, Any]]:
    """Get all section requirements (from SectionSubject) for the term."""
    from catalog.models import SectionSubject
    
    requirements = []
    section_subjects = SectionSubject.objects.filter(
        section__term=term
    ).select_related('section', 'subject')
    
    for ss in section_subjects:
        requirements.append({
            'section_id': ss.section_id,
            'section_name': ss.section.name,
            'section_headcount': ss.section.headcount,
            'section_department': ss.section.program,  # derived from program
            'subject_id': ss.subject_id,
            'subject_code': ss.subject.code,
            'subject_title': ss.subject.title,
            'subject_mode': 'sync',  # default, could be enhanced
        })
    return requirements


def _get_professor_qualifications(term: AcademicTerm) -> Dict[int, List[int]]:
    """Get professor subject qualifications from ProfessorSubject."""
    from catalog.models import ProfessorSubject
    
    quals = defaultdict(list)
    for ps in ProfessorSubject.objects.filter(
        professor__assignments__term=term
    ).distinct():
        quals[ps.professor_id].append(ps.subject_id)
    return dict(quals)


def check_feasibility(term: AcademicTerm) -> Dict[str, Any]:
    """
    Run comprehensive feasibility checks for schedule generation.
    
    Returns:
        Dict with feasibility status, violations, recommendations, and bottlenecks.
    """
    violations = []
    warnings = []
    recommendations = []
    bottlenecks = []
    
    # Get data
    meeting_counts = _get_meeting_counts(term)
    room_counts = _get_room_counts()
    prof_loads = _get_professor_loads(term)
    room_capacities = _get_room_capacities_by_type()
    requirements = _get_section_requirements(term)
    qualifications = _get_professor_qualifications(term)
    
    # --- 1. Lab room shortage (Critical) ---
    lab_meetings = meeting_counts.get('lab', 0)
    lab_rooms = room_counts.get('laboratory', 0)
    general_rooms = room_counts.get('general', 0)
    
    # Lab meetings can use lab rooms OR general rooms as fallback
    effective_lab_rooms = lab_rooms + general_rooms
    if effective_lab_rooms == 0 and lab_meetings > 0:
        violations.append({
            'type': 'lab_shortage',
            'message': f'{lab_meetings} lab meetings but 0 lab/general rooms available',
            'severity': 'critical',
        })
        recommendations.append('Add lab rooms (type=laboratory) or general rooms')
        bottlenecks.append({
            'type': 'lab_rooms',
            'ratio': 999999,
            'lab_meetings': lab_meetings,
            'lab_rooms': effective_lab_rooms,
        })
    elif effective_lab_rooms > 0:
        # Slots per day = 12 (07:00-19:00 = 12 hours)
        max_lab_slots_per_week = effective_lab_rooms * 12 * 5  # 5 days
        lab_ratio = lab_meetings / max_lab_slots_per_week if max_lab_slots_per_week > 0 else 999999
        if lab_ratio > 0.8:
            violations.append({
                'type': 'lab_shortage',
                'message': f'{lab_meetings} lab meetings for {effective_lab_rooms} lab/general rooms (utilization: {lab_ratio:.1%})',
                'severity': 'critical' if lab_ratio > 1.0 else 'warning',
            })
            recommendations.append(f'Add {max(1, int(lab_meetings / (12 * 5)) - effective_lab_rooms + 1)} more lab/general rooms')
            bottlenecks.append({
                'type': 'lab_rooms',
                'ratio': lab_ratio,
                'lab_meetings': lab_meetings,
                'lab_rooms': effective_lab_rooms,
            })
    
    # --- 2. Professor availability gaps ---
    for prof_id, load in prof_loads.items():
        weekly_hours = load['weekly_hours']
        max_daily = load['max_daily']
        availability = load['availability_windows']
        
        # Check if professor has any availability at all
        if weekly_hours > 0 and not availability:
            violations.append({
                'type': 'availability_gap',
                'message': f'Professor {prof_id} has {weekly_hours}h/week but no availability windows',
                'severity': 'critical',
            })
            recommendations.append(f'Add availability windows for professor {prof_id}')
        elif weekly_hours > 0:
            # Check if available hours cover required hours
            available_hours_per_week = 0
            for day, windows in availability.items():
                for w in windows:
                    start_min = w['start'].hour * 60 + w['start'].minute
                    end_min = w['end'].hour * 60 + w['end'].minute
                    available_hours_per_week += (end_min - start_min) / 60
            
            if available_hours_per_week < weekly_hours * 0.8:
                violations.append({
                    'type': 'availability_gap',
                    'message': f'Professor {prof_id}: {weekly_hours}h required but only {available_hours_per_week:.1f}h available/week',
                    'severity': 'warning',
                })
                recommendations.append(f'Extend availability windows for professor {prof_id}')
    
    # --- 3. Daily hour caps ---
    for prof_id, load in prof_loads.items():
        weekly_hours = load['weekly_hours']
        max_daily = load['max_daily']
        max_weekly = max_daily * 5  # 5 working days
        
        if weekly_hours > max_weekly:
            violations.append({
                'type': 'daily_cap_exceeded',
                'message': f'Professor {prof_id}: {weekly_hours}h/week exceeds max {max_weekly}h/week ({max_daily}h/day × 5 days)',
                'severity': 'warning',
            })
            recommendations.append(f'Increase max_daily_hours for professor {load.get("professor_name", prof_id)} to {int(weekly_hours / 5) + 1}')
    
    # --- 4. Consecutive hours limits ---
    for prof_id, load in prof_loads.items():
        max_consecutive = load['max_consecutive']
        # We can't easily check without knowing placements, but warn if default is low
        if load['max_consecutive'] < 4:
            warnings.append({
                'type': 'consecutive_limit_low',
                'message': f'Professor {prof_id}: max_consecutive={load["max_consecutive"]} may be too restrictive',
                'severity': 'info',
            })
    
    # --- 3. Room capacity vs section headcount ---
    section_headcounts = {}
    for req in requirements:
        section_headcounts[req['section_id']] = req['section_headcount']
    
    max_capacity_by_type = {
        k: max(v) if v else 0 for k, v in room_capacities.items()
    }
    
    for section_id, headcount in section_headcounts.items():
        if headcount > max_capacity_by_type.get('general', 0) and headcount > max_capacity_by_type.get('lecture', 0):
            violations.append({
                'type': 'room_capacity',
                'message': f'Section {section_id} headcount ({headcount}) exceeds all room capacities (max: {max(max_capacity_by_type.values())})',
                'severity': 'critical',
            })
            recommendations.append('Add larger rooms or reduce section headcounts')
    
    # --- 4. Room type match ---
    lab_meetings = meeting_counts.get('lab', 0)
    lab_rooms = room_counts.get('laboratory', 0)
    general_rooms = room_counts.get('general', 0)
    effective_lab_rooms = lab_rooms + general_rooms
    if lab_meetings > 0 and effective_lab_rooms == 0:
        violations.append({
            'type': 'room_type_mismatch',
            'message': f'{lab_meetings} lab meetings but 0 lab/general rooms available',
            'severity': 'critical',
        })
        recommendations.append('Add lab rooms (type=laboratory) or general rooms')
    
    # --- 5. Department matching ---
    # Check if professors have rooms in their department
    dept_rooms = defaultdict(list)
    for room in Room.objects.all():
        if room.department_id:
            dept_rooms[room.department_id].append(room.id)
    
    prof_depts = {}
    for prof_id, load in prof_loads.items():
        if load['department']:
            prof_depts[prof_id] = load['department']
    
    for prof_id, dept_id in prof_depts.items():
        if dept_id not in dept_rooms or not dept_rooms[dept_id]:
            # Check if there are general rooms
            if room_counts.get('general', 0) == 0:
                warnings.append({
                    'type': 'department_mismatch',
                    'message': f'Professor {prof_id} (dept={dept_id}) has no department-specific rooms and no general rooms',
                    'severity': 'warning',
                })
                recommendations.append(f'Add general rooms or assign rooms to department {dept_id}')
    
    # --- 5. Professor qualification coverage ---
    required_subjects = set()
    for req in requirements:
        required_subjects.add(req['subject_id'])
    
    qualified_subjects = set()
    for subjs in qualifications.values():
        qualified_subjects.update(subjs)
    
    unqualified = required_subjects - qualified_subjects
    if unqualified:
        violations.append({
            'type': 'qualification_gap',
            'message': f'{len(unqualified)} subjects have no qualified professors',
            'severity': 'critical',
        })
        recommendations.append('Add ProfessorSubject qualifications for missing subjects')
    
    # --- 6. Room capacity for sections ---
    max_general_capacity = max(room_capacities.get('general', [0]))
    max_lecture_capacity = max(room_capacities.get('lecture', [0]))
    max_lab_capacity = max(room_capacities.get('laboratory', [0]))
    
    max_capacity_overall = max(
        max_general_capacity, max_lecture_capacity, max_lab_capacity
    )
    
    for section_id, headcount in section_headcounts.items():
        if headcount > max_capacity_overall:
            violations.append({
                'type': 'room_capacity',
                'message': f'Section {section_id} headcount ({headcount}) exceeds max room capacity ({max_capacity_overall})',
                'severity': 'critical',
            })
    
    # Determine overall feasibility
    has_critical = any(v['severity'] == 'critical' for v in violations)
    feasible = not has_critical
    
    # Calculate estimated placement rate
    total_meetings = meeting_counts['total']
    if total_meetings > 0:
        # Simple heuristic: if critical violations exist, rate drops
        if violations:
            critical_count = sum(1 for v in violations if v['severity'] == 'critical')
            estimated_rate = max(0.0, 1.0 - (critical_count * 0.3))
        else:
            estimated_rate = 0.95
    else:
        estimated_rate = 1.0
    
    # Build bottlenecks summary
    bottleneck_summary = []
    if lab_meetings > 0 and room_counts.get('laboratory', 0) > 0:
        slots_per_week = room_counts['laboratory'] * 12 * 5
        ratio = lab_meetings / slots_per_week if slots_per_week > 0 else float('inf')
        bottleneck_summary.append({
            'type': 'lab_rooms',
            'ratio': ratio,
            'message': f'{lab_meetings} lab meetings / {slots_per_week} weekly lab slots = {ratio:.1%} utilization',
        })
    
    return {
        'feasible': feasible,
        'violations': violations,
        'warnings': warnings,
        'recommendations': list(set(recommendations)),  # deduplicate
        'bottlenecks': bottlenecks,
        'estimated_placement_rate': estimated_rate,
        'summary': {
            'total_meetings': meeting_counts['total'],
            'lab_meetings': meeting_counts.get('lab', 0),
            'sync_meetings': meeting_counts.get('sync', 0),
            'async_meetings': meeting_counts.get('async', 0),
            'total_rooms': room_counts['total'],
            'lab_rooms': room_counts.get('laboratory', 0),
            'lecture_rooms': room_counts.get('lecture', 0),
            'general_rooms': room_counts.get('general', 0),
            'professors': len(prof_loads),
        }
    }


def check_feasibility_simple(term: AcademicTerm) -> Dict[str, Any]:
    """Simplified feasibility check for quick dry-run."""
    # Just check the most critical constraints quickly
    meeting_counts = _get_meeting_counts(term)
    room_counts = _get_room_counts()
    
    critical = []
    warnings = []
    
    lab_meetings = meeting_counts.get('lab', 0)
    lab_rooms = room_counts.get('laboratory', 0)
    
    if lab_meetings > 0 and lab_rooms == 0:
        critical.append('No lab rooms for lab meetings')
    
    # Quick capacity check
    from catalog.models import Room, Section
    max_cap = Room.objects.aggregate(max_cap=models.Max('capacity'))['max_cap'] or 0
    max_headcount = Section.objects.aggregate(max_hc=models.Max('headcount'))['max_hc'] or 0
    
    if max_headcount > max_cap:
        critical.append(f'Max section headcount ({max_headcount}) exceeds max room capacity ({max_cap})')
    
    return {
        'feasible': len(critical) == 0,
        'critical_violations': critical,
        'warnings': warnings,
    }