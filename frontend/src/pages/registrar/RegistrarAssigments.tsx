import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Play } from 'lucide-react';
import { initialTeachers } from './registrarData';

const SLOT_POOL = [
  { day_of_week: 0, time_slot_label: '7:00 AM - 10:00 AM', room: 'Room 101' },
  { day_of_week: 1, time_slot_label: '10:00 AM - 1:00 PM', room: 'Room 102' },
  { day_of_week: 2, time_slot_label: '1:00 PM - 4:00 PM', room: 'Room 103' },
  { day_of_week: 3, time_slot_label: '8:00 AM - 11:00 AM', room: 'Lab 201' },
  { day_of_week: 4, time_slot_label: '2:00 PM - 5:00 PM', room: 'Lab 202' },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

export default function RegistrarAssigments() {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [generating, setGenerating] = useState(false);

  const pendingTotal = teachers.reduce(
    (sum, teacher) =>
      sum + teacher.assignments.filter((a) => !a.scheduled).length,
    0
  );

  const handleGenerate = () => {
    if (generating || pendingTotal === 0) return;

    setGenerating(true);
    window.setTimeout(() => {
      let slotIndex = 0;
      setTeachers((prev) =>
        prev.map((teacher) => ({
          ...teacher,
          assignments: teacher.assignments.map((assignment) => {
            if (assignment.scheduled) return assignment;
            const slot = SLOT_POOL[slotIndex++ % SLOT_POOL.length];
            return { ...assignment, scheduled: true, ...slot };
          }),
        }))
      );
      setGenerating(false);
    }, 1400);
  };

  return (
    <section className='w-full'>
      <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-lg font-medium text-text-primary'>
            Assignments
          </h1>
          <p className='text-sm text-text-secondary'>
            {teachers.length} {teachers.length === 1 ? 'teacher' : 'teachers'} ·{' '}
            {pendingTotal} pending
          </p>
        </div>

        <button
          type='button'
          onClick={handleGenerate}
          disabled={generating || pendingTotal === 0}
          className='inline-flex items-center gap-2 rounded-md bg-apple-green-400 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-apple-green-600 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {generating ? (
            <Loader2 size={14} className='animate-spin' />
          ) : (
            <Play size={14} />
          )}
          {generating ? 'Generating…' : 'Generate schedule'}
        </button>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {teachers.map((teacher) => {
          const pending = teacher.assignments.filter(
            (a) => !a.scheduled
          ).length;

          return (
            <Link
              key={teacher.id}
              to={`/teacher-assigment/${teacher.id}`}
              className='group flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-4 py-4 transition hover:border-apple-green-200 hover:shadow-sm'
            >
              <div className='flex min-w-0 items-center gap-3'>
                <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-apple-green-50 text-xs font-medium text-apple-green-700'>
                  {initialsOf(teacher.full_name)}
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-text-primary'>
                    {teacher.full_name}
                  </p>
                  <p className='truncate text-xs text-text-tertiary'>
                    {teacher.department_name}
                  </p>
                </div>
              </div>

              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-text-secondary'>
                  {teacher.assignments.length}{' '}
                  {teacher.assignments.length === 1
                    ? 'assignment'
                    : 'assignments'}
                </span>

                {pending > 0 ? (
                  <span className='shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700'>
                    {pending} pending
                  </span>
                ) : (
                  <span className='shrink-0 rounded-full bg-apple-green-50 px-2.5 py-1 text-[10px] font-medium text-apple-green-700'>
                    All scheduled
                  </span>
                )}
              </div>

              <span className='mt-auto inline-flex items-center gap-1 text-xs font-medium text-apple-green-700 transition group-hover:gap-1.5'>
                View assignments
                <ChevronRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
