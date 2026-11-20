// pages/teacher/TeacherAssignmentPage.tsx
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import { ModeBadge } from '../../components/shared/ModeBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
import type {
  CourseAssignmentDetail,
  Schedule,
} from '../../types/Types';

function totalMeetingHours(assignment: CourseAssignmentDetail): number {
  return (
    assignment.meetings?.reduce((sum, m) => sum + (m.duration_slots ?? 0), 0) ??
    0
  );
}

function scheduledHoursForAssignment(
  resolvedSchedules: Schedule[],
  assignmentId: number
): number {
  return resolvedSchedules
    .filter((s) => s.assignment === assignmentId)
    .reduce((sum, s) => sum + (s.duration_slots ?? 0), 0);
}

function assignmentStatus(
  assignment: CourseAssignmentDetail,
  resolvedSchedules: Schedule[]
): 'scheduled' | 'partially_scheduled' | 'pending' {
  const total = totalMeetingHours(assignment);
  if (total === 0) return 'pending';
  const scheduled = scheduledHoursForAssignment(resolvedSchedules, assignment.id);
  if (scheduled === 0) return 'pending';
  if (scheduled >= total) return 'scheduled';
  return 'partially_scheduled';
}

function modeGroups(assignment: CourseAssignmentDetail): Array<{
  mode: string;
  hours: number;
}> {
  const groups: Array<{ mode: string; hours: number }> = [];
  assignment.meetings?.forEach((m) => {
    const existing = groups.find((g) => g.mode === m.mode_display);
    if (existing) {
      existing.hours += m.duration_slots ?? 0;
    } else {
      groups.push({ mode: m.mode_display ?? '—', hours: m.duration_slots ?? 0 });
    }
  });
  return groups;
}

function formatTimeRange(start: string | null, end: string | null): string {
  const to12h = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:${String(m ?? 0).padStart(2, '0')} ${period}`;
  };
  if (!start || !end) return '—';
  return `${to12h(start)} – ${to12h(end)}`;
}

export default function TeacherAssignmentPage() {
  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.professor?.id;

  const {
    data: assignments,
    isLoading,
    isError,
  } = useCourseAssignments();

  const { data: schedules } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const resolvedAssignments: CourseAssignmentDetail[] = assignments ?? [];
  const resolvedSchedules: Schedule[] = schedules ?? [];

  // Slide-over panel state
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <section className='w-full'>
        <p className='text-sm text-text-secondary'>Loading courses…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className='w-full'>
        <p className='text-sm text-text-secondary'>
          Unable to load your courses.
        </p>
      </section>
    );
  }

  if (resolvedAssignments.length === 0) {
    return (
      <section className='w-full'>
        <p className='mb-6 text-sm text-text-secondary'>
          1st semester, 2026 to 2027
        </p>
        <p className='text-sm text-text-secondary'>
          No courses assigned yet.
        </p>
      </section>
    );
  }

  const openAssignment = resolvedAssignments.find(
    (a) => a.id === openAssignmentId
  );

  return (
    <section className='w-full'>
      <p className='mb-6 text-sm text-text-secondary'>
        1st semester, 2026 to 2027
      </p>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {resolvedAssignments.map((assignment) => {
          const status = assignmentStatus(assignment, resolvedSchedules);
          const totalHours = totalMeetingHours(assignment);
          const groups = modeGroups(assignment);

          return (
            <div
              key={assignment.id}
              className='
                flex h-full flex-col gap-3
                rounded-2xl border border-border bg-surface
                px-3 py-3 sm:px-4 sm:py-4
                md:px-5 md:py-4
                transition
                hover:border-apple-green-200 hover:shadow-sm
                cursor-pointer
              '
              onClick={() => setOpenAssignmentId(assignment.id)}
            >
              {/* Course info */}
              <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
                <span className='text-base font-semibold tracking-tight text-text-primary'>
                  {assignment.subject_label}
                </span>
              </div>

              <div className='flex min-w-0 flex-col gap-1'>
                <span className='text-xs text-text-tertiary uppercase tracking-wide'>
                  Section {assignment.section_name}
                </span>
                {totalHours > 0 && (
                  <span className='text-xs text-text-tertiary uppercase tracking-wide'>
                    {totalHours} HRS/WK
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className='mt-3 flex flex-wrap gap-2'>
                {groups.map((g, idx) => (
                  <ModeBadge key={idx} mode={g.mode} />
                ))}
                <StatusBadge status={status} />
              </div>

              <div className='mt-auto flex items-center gap-2 text-xs text-text-tertiary'>
                <span>View details →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over panel */}
      {openAssignment && (
        <AssignmentDetailPanel
          assignment={openAssignment}
          schedules={resolvedSchedules}
          onClose={() => setOpenAssignmentId(null)}
        />
      )}
    </section>
  );
}

export function AssignmentDetailPanel({
  assignment,
  schedules,
  onClose,
}: {
  assignment: CourseAssignmentDetail;
  schedules: Schedule[];
  onClose: () => void;
}) {
  const defaultMode = assignment.meetings?.[0]?.mode_display ?? null;
  const [selectedMeetingMode, setSelectedMeetingMode] = useState<string | null>(
    defaultMode
  );

  const totalHours = totalMeetingHours(assignment);
  const groups = modeGroups(assignment);

  // Default to first meeting mode if none selected
  const effectiveMode = selectedMeetingMode ?? groups[0]?.mode ?? null;

  const selectedSchedule = schedules.find(
    (s) =>
      s.assignment === assignment.id && s.mode_display === effectiveMode
  );

  const selectedStatus = selectedSchedule
    ? 'scheduled'
    : effectiveMode
      ? 'pending'
      : 'pending';

  const modeStyle = (mode: string | null) => {
    switch (mode) {
      case 'Synchronous':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200';
      case 'Laboratory':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Asynchronous':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-surface-secondary text-text-tertiary border-border';
    }
  };

  const isActiveMode = (mode: string | null) =>
    mode === effectiveMode;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}
    >
      <div
        className='flex flex-col max-h-[90vh] w-full max-w-md rounded-2xl border border-border bg-surface shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-start justify-between gap-3 border-b border-border px-6 py-4 shrink-0'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>
              Assignment Details
            </h2>
            <p className='text-xs text-text-tertiary'>
              {assignment.subject_label} · Section {assignment.section_name}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='shrink-0 grid h-7 w-7 place-items-center rounded-md text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          {/* Header info section */}
          <div className='mb-6'>
            <div className='flex flex-wrap gap-2 mb-3'>
              {groups.map((g, idx) => {
                const active = isActiveMode(g.mode);
                return (
                  <button
                    key={idx}
                    type='button'
                    onClick={() => setSelectedMeetingMode(g.mode)}
                    className={`rounded-full px-3 py-1 text-[10px] font-medium border transition-all duration-200 cursor-pointer ${
                      active
                        ? modeStyle(g.mode) + ' ring-2 ring-offset-1'
                        : 'bg-surface-secondary text-text-tertiary border-border opacity-70 hover:opacity-100 hover:bg-surface-hover'
                    }`}
                  >
                    {g.mode} · {g.hours}h
                  </button>
                );
              })}
              <StatusBadge status={selectedStatus} />
            </div>
            <p className='text-xs text-text-tertiary uppercase tracking-wide'>
              Academic Term
            </p>
            <p className='text-sm font-medium text-text-primary'>
              1st semester, 2026 to 2027
            </p>
            {totalHours > 0 && (
              <div className='mt-2'>
                <p className='text-xs text-text-tertiary uppercase tracking-wide'>
                  Weekly Hours
                </p>
                <p className='text-sm font-medium text-text-primary'>
                  {totalHours} hours
                </p>
              </div>
            )}
          </div>

          {/* Schedule details section */}
          <div className='mb-6'>
            <h3 className='text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3'>
              Schedule Details
            </h3>
            {selectedSchedule ? (
              <div className='grid grid-cols-2 gap-4'>
                <div className='rounded-lg border border-border bg-surface-secondary p-4'>
                  <p className='text-xs font-medium text-text-tertiary'>Day</p>
                  <p className='text-sm font-medium text-text-primary'>
                    {selectedSchedule.day_display ?? '—'}
                  </p>
                </div>
                <div className='rounded-lg border border-border bg-surface-secondary p-4'>
                  <p className='text-xs font-medium text-text-tertiary'>Time</p>
                  <p className='text-sm font-medium text-text-primary'>
                    {formatTimeRange(
                      selectedSchedule.start_time,
                      selectedSchedule.end_time
                    )}
                  </p>
                </div>
                <div className='rounded-lg border border-border bg-surface-secondary p-4'>
                  <p className='text-xs font-medium text-text-tertiary'>Room</p>
                  <p className='text-sm font-medium text-text-primary'>
                    {selectedSchedule.room_name ?? 'Unassigned'}
                  </p>
                </div>
                <div className='rounded-lg border border-border bg-surface-secondary p-4'>
                  <p className='text-xs font-medium text-text-tertiary'>Section</p>
                  <p className='text-sm font-medium text-text-primary'>
                    {selectedSchedule.section_name ?? assignment.section_name}
                  </p>
                </div>
              </div>
            ) : (
              <div className='rounded-lg border border-border bg-surface-secondary p-8 flex flex-col items-center justify-center text-center'>
                <span className='text-amber-600 font-medium text-sm mb-2'>
                  Pending schedule assignment
                </span>
                <p className='text-xs text-text-tertiary'>
                  This class has not been assigned a day, time, or room yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='shrink-0 border-t border-border px-6 py-4 flex justify-end gap-3 bg-surface'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
