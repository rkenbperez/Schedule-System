// pages/teacher/CreateSchedulePage.tsx
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCourseAssignments, useCourseComponents, useCreateSchedule } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import type { ScheduleCreatePayload } from '../../types/Types';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  { id: 1, label: '7:00 AM - 10:00 AM', start_time: '07:00' },
  { id: 2, label: '10:00 AM - 1:00 PM', start_time: '10:00' },
  { id: 3, label: '1:00 PM - 3:00 PM', start_time: '13:00' },
  { id: 4, label: '3:00 PM - 6:00 PM', start_time: '15:00' },
];

export default function CreateSchedulePage() {
  const { 'course-assigment-id': assignmentIdStr } = useParams();
  const assignmentId = assignmentIdStr ? Number(assignmentIdStr) : NaN;

  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const presetComponentId = searchParams.get('component');
  const navigate = useNavigate();

  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.teacher_profile?.id;

  const {
    data: assignments,
    isLoading: assignmentsLoading,
  } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });

  const assignment = assignments?.find((a) => a.id === assignmentId);

  const {
    data: components,
    isLoading: componentsLoading,
  } = useCourseComponents({
    courseId: assignment?.course.id,
    enabled: !!assignment?.course.id,
  });

  const createSchedule = useCreateSchedule();

  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(
    presetComponentId ? Number(presetComponentId) : null
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ id: number; label: string; start_time: string } | null>(null);

  const handleCreate = () => {
    if (!selectedComponentId || !selectedDay || !selectedTimeSlot) return;

    const payload: ScheduleCreatePayload = {
      course_assignment: assignmentId,
      course_component: selectedComponentId,
      room: 0,
      start_time: selectedTimeSlot.start_time,
      day_of_week: selectedDay,
    };

    createSchedule.mutate(payload, {
      onSuccess: () => {
        navigate(`/teacher/juan/schedules`);
      },
    });
  };

  if (assignmentsLoading || componentsLoading) {
    return (
      <section className='w-full max-w-2xl'>
        <p className='text-sm text-text-secondary'>Loading...</p>
      </section>
    );
  }

  if (!assignment) {
    return (
      <section className='w-full max-w-2xl'>
        <p className='text-sm text-text-secondary'>Course not found.</p>
      </section>
    );
  }

  return (
    <section className='w-full max-w-2xl'>
      <Link
        to='/teacher/juan/courses'
        className='mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
      >
        ← Back to my courses
      </Link>

      <h1 className='mb-1 text-lg font-medium text-text-primary'>
        Select a schedule
      </h1>
      <p className='mb-6 text-[13px] text-text-secondary'>
        Pick a component, day, and time slot for {assignment.course.code}.
      </p>

      <div className='rounded-card border border-border bg-surface p-6'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Component
            </label>
            <div className='flex flex-col gap-1'>
              {(components ?? []).map((component) => (
                <button
                  key={component.id}
                  type='button'
                  onClick={() => setSelectedComponentId(component.id)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedComponentId === component.id
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  {component.label} ({component.room_type})
                </button>
              ))}
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Day
            </label>
            <div className='flex flex-col gap-1'>
              {DAY_LABELS.map((day, index) => (
                <button
                  key={index}
                  type='button'
                  onClick={() => setSelectedDay(index)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedDay === index
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Time slot
            </label>
            <div className='flex flex-col gap-1'>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type='button'
                  onClick={() => setSelectedTimeSlot(slot)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedTimeSlot?.id === slot.id
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {createSchedule.isPending ? (
          <p className='mt-4 text-sm text-text-secondary'>Creating schedule...</p>
        ) : (
          <button
            onClick={handleCreate}
            disabled={
              createSchedule.isPending ||
              !selectedComponentId ||
              selectedDay === null ||
              !selectedTimeSlot
            }
            className='mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {createSchedule.isPending ? 'Creating…' : 'Create Schedule'}
          </button>
        )}
      </div>
    </section>
  );
}
