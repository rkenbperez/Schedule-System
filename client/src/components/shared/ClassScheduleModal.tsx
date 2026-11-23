// components/shared/ClassScheduleModal.tsx
// Canonical scheduling modal used by both the Teachers page and the Master
// Schedule workspace. Create mode schedules an unscheduled assignment; edit
// mode updates or deletes an existing scheduled class.
// When no assignment is pre-selected (click-to-schedule from an empty grid
// cell), the user picks professor / subject / section and an assignment is
// created on the fly before scheduling.
import { useState } from 'react';
import { X } from 'lucide-react';
import {
  useCreateAssignment,
  useCreateRegistrarSchedule,
  useDeleteScheduledClass,
  useUpdateScheduledClass,
} from '../../hooks/Schedule.hooks';
import type {
  Course,
  CourseAssignmentDetail,
  Room,
  Schedule,
  Section,
  TeacherListItem,
} from '../../types/Types';
import { DAY_LABELS } from '../../types/Types';

const TIME_SLOTS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

const MODE_OPTIONS = [
  { value: 'sync', label: 'Synchronous' },
  { value: 'async', label: 'Asynchronous' },
  { value: 'lab', label: 'Laboratory' },
];

const DURATION_OPTIONS = [1, 2, 3];

type CommonProps = {
  runId: number;
  professors: TeacherListItem[];
  courses: Course[];
  sections: Section[];
  rooms: Room[];
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
  /** Pre-fill day (0-5) when opening from a grid cell click. */
  prefilledDay?: number;
  /** Pre-fill start time (HH:MM) when opening from a grid cell click. */
  prefilledStartTime?: string;
};

export type ClassScheduleModalProps =
  | (CommonProps & {
      mode: 'create';
      assignment?: CourseAssignmentDetail;
      schedule?: never;
    })
  | (CommonProps & {
      mode: 'edit';
      schedule: Schedule;
      assignment?: never;
    });

export function ClassScheduleModal(props: ClassScheduleModalProps) {
  const {
    mode,
    runId,
    professors,
    courses,
    sections,
    rooms,
    onClose,
    onSaved,
    onDeleted,
    prefilledDay,
    prefilledStartTime,
  } = props;

  const hasAssignment =
    mode === 'create' && !!props.assignment;

  const [profId, setProfId] = useState<number | null>(
    mode === 'create'
      ? props.assignment?.prof ?? null
      : props.schedule.prof_id
  );
  const [subjectId, setSubjectId] = useState<number | null>(
    mode === 'create'
      ? props.assignment?.subject ?? null
      : props.schedule.subject_id ?? null
  );
  const [sectionId, setSectionId] = useState<number | null>(
    mode === 'create'
      ? props.assignment?.section ?? null
      : props.schedule.section_id
  );
  const [roomId, setRoomId] = useState<number | null>(
    mode === 'create' ? null : props.schedule.room
  );
  const [day, setDay] = useState<number | null>(
    prefilledDay ?? (mode === 'create' ? null : props.schedule.day)
  );
  const [startTime, setStartTime] = useState<string>(
    prefilledStartTime ??
      (mode === 'create' ? '' : props.schedule.start_time.slice(0, 5))
  );
  const [durationSlots, setDurationSlots] = useState<number>(
    mode === 'create'
      ? props.assignment?.meetings?.[0]?.duration_slots ?? 1
      : props.schedule.duration_slots
  );
  const [classMode, setClassMode] = useState<string>(
    mode === 'create'
      ? props.assignment?.meetings?.[0]?.mode ?? 'sync'
      : props.schedule.mode ?? 'sync'
  );
  const [academicTermId, setAcademicTermId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createSchedule = useCreateRegistrarSchedule();
  const updateClass = useUpdateScheduledClass();
  const deleteClass = useDeleteScheduledClass();
  const createAssignment = useCreateAssignment();

  const isSaving = createSchedule.isPending || updateClass.isPending;
  const isCreatingAssignment = createAssignment.isPending;
  const isDeleting = deleteClass.isPending;
  const isBusy = isSaving || isCreatingAssignment || isDeleting;

  const subtitle =
    mode === 'create'
      ? hasAssignment
        ? `${props.assignment!.prof_name} · ${props.assignment!.subject_label} → ${props.assignment!.section_name}`
        : 'New assignment — select professor, subject and section'
      : `${props.schedule.prof_name} · ${props.schedule.subject_label} → ${props.schedule.section_name}`;

  const endTime = startTime
    ? (() => {
        const [h, m] = startTime.split(':').map(Number);
        const end = new Date(0, 0, 0, h + durationSlots, m);
        return `${String(end.getHours()).padStart(2, '0')}:${String(
          end.getMinutes()
        ).padStart(2, '0')}`;
      })()
    : '—';

  const handleSubmit = async () => {
    if (roomId === null || day === null || !startTime) {
      setError('Please select a room, day, and start time.');
      return;
    }
    if (!hasAssignment && (profId === null || subjectId === null || sectionId === null)) {
      setError('Please select a professor, subject, and section.');
      return;
    }

    setError(null);

    try {
      let assignmentId = hasAssignment ? props.assignment!.id : null;

      if (!assignmentId) {
        // Create the assignment on the fly from the selected professor /
        // subject / section, then schedule it at the chosen slot.
        const created = await createAssignment.mutateAsync({
          teacher: profId!,
          course: subjectId!,
          section: sectionId!,
          academic_term: academicTermId ?? undefined,
          type: classMode as 'sync' | 'async' | 'lab',
        });
        assignmentId = created.id;
      }

      await createSchedule.mutateAsync({
        runId,
        payload: {
          course_assignment: assignmentId,
          room: roomId,
          start_time: startTime,
          day_of_week: day,
          duration_slots: durationSlots,
          mode: classMode,
        },
      });

      onSaved?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to schedule class.'
      );
    }
  };

  const handleDelete = async () => {
    if (mode !== 'edit') return;

    setError(null);
    try {
      await deleteClass.mutateAsync({
        runId: props.schedule.run,
        classId: props.schedule.id,
      });
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete scheduled class.'
      );
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label={mode === 'create' ? 'Schedule Class' : 'Edit Class'}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}
    >
      <div
        className='flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>
              {mode === 'create' ? 'Schedule Class' : 'Edit Class'}
            </h2>
            <p className='text-xs text-text-tertiary'>{subtitle}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          {!hasAssignment && mode === 'create' && (
            <div className='mb-4 rounded-lg border border-border bg-surface-secondary p-4'>
              <p className='text-sm font-medium text-text-primary'>
                Create assignment for new class
              </p>
              <p className='mt-1 text-xs text-text-secondary'>
                Select the professor, subject and section to schedule.
              </p>
            </div>
          )}
          {props.assignment && mode === 'create' && (
            <div className='mb-4 rounded-lg border border-border bg-surface-secondary p-4'>
              <p className='text-sm font-medium text-text-primary'>
                {props.assignment.subject_label}
              </p>
              <p className='mt-1 text-xs text-text-secondary'>
                {props.assignment.prof_name} ·{' '}
                {props.assignment.section_name}
              </p>
            </div>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {!hasAssignment && mode === 'create' && (
              <>
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Professor
                  </label>
                  <select
                    value={profId ?? ''}
                    onChange={(e) =>
                      setProfId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select professor</option>
                    {professors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.full_name || professor.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Subject
                  </label>
                  <select
                    value={subjectId ?? ''}
                    onChange={(e) =>
                      setSubjectId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select subject</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} — {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Section
                  </label>
                  <select
                    value={sectionId ?? ''}
                    onChange={(e) =>
                      setSectionId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Academic Term
                  </label>
                  <select
                    value={academicTermId ?? ''}
                    onChange={(e) =>
                      setAcademicTermId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Optional term</option>
                  </select>
                </div>
              </>
            )}
            {mode === 'edit' && (
              <>
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Professor
                  </label>
                  <select
                    value={profId ?? ''}
                    onChange={(e) =>
                      setProfId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select professor</option>
                    {professors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.full_name || professor.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Subject
                  </label>
                  <select
                    value={subjectId ?? ''}
                    onChange={(e) =>
                      setSubjectId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select subject</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} — {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Section
                  </label>
                  <select
                    value={sectionId ?? ''}
                    onChange={(e) =>
                      setSectionId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                Room
              </label>
              <select
                value={roomId ?? ''}
                onChange={(e) =>
                  setRoomId(e.target.value ? Number(e.target.value) : null)
                }
                className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
              >
                <option value=''>Select room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name || `Room ${room.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                Day
              </label>
              <select
                value={day ?? ''}
                onChange={(e) =>
                  setDay(e.target.value ? Number(e.target.value) : null)
                }
                className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
              >
                <option value=''>Select day</option>
                {DAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                Start Time
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
              >
                <option value=''>Select time</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                Duration (slots)
              </label>
              <select
                value={durationSlots}
                onChange={(e) => setDurationSlots(Number(e.target.value))}
                className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                Mode
              </label>
              <select
                value={classMode}
                onChange={(e) => setClassMode(e.target.value)}
                className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs font-medium text-text-secondary'>
                End Time
              </label>
              <div className='flex h-9 items-center rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-secondary'>
                {endTime}
              </div>
            </div>
          </div>

          {error && (
            <div className='mt-4 rounded-lg border border-red-200 bg-red-50 p-3'>
              <p className='text-xs text-red-700'>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4'>
          <button
            type='button'
            onClick={onClose}
            className='h-9 rounded-lg border border-border bg-surface-tertiary px-4 text-xs font-medium text-text-secondary transition hover:bg-surface-secondary'
          >
            Cancel
          </button>
          {mode === 'edit' && (
            <button
              type='button'
              onClick={handleDelete}
              disabled={isBusy}
              className='h-9 rounded-lg bg-red-600 px-4 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60'
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button
            type='button'
            onClick={handleSubmit}
            disabled={isBusy}
            className='h-9 rounded-lg bg-apple-green-600 px-4 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
          >
            {isCreatingAssignment
              ? 'Creating…'
              : isSaving
                ? mode === 'create'
                  ? 'Scheduling…'
                  : 'Saving…'
                : mode === 'create'
                  ? hasAssignment
                    ? 'Schedule'
                    : 'Create & Schedule'
                  : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
