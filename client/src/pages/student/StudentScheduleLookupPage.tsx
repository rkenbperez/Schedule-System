import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStudentSchedule } from '../../hooks/Schedule.hooks';

type StudentScheduleItem = {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  course_assignment?: { course?: { code: string } };
  course_component?: { label: string };
  room?: { code: string };
  section?: { code: string };
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentScheduleLookupPage() {
  const [section, setSection] = useState('');
  const [term, setTerm] = useState('');

  const {
    data: schedules,
    isLoading,
    error,
    refetch,
  } = useStudentSchedule(section, term || undefined, { enabled: false });

  const items = (schedules ?? []) as StudentScheduleItem[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!section.trim()) return;
    refetch();
  };

  return (
    <section className='w-full max-w-xl'>
      <form onSubmit={handleSubmit} className='mb-8 flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <label
            htmlFor='section'
            className='text-sm font-medium text-text-primary'
          >
            Section Code
          </label>
          <input
            id='section'
            type='text'
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder='e.g. 3-A'
            className='h-10 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
          />
        </div>

        <div className='flex flex-col gap-2'>
          <label
            htmlFor='term'
            className='text-sm font-medium text-text-primary'
          >
            Term ID (optional)
          </label>
          <input
            id='term'
            type='number'
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder='e.g. 1'
            className='h-10 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
          />
        </div>

        <button
          type='submit'
          disabled={isLoading || !section.trim()}
          className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
        >
          <Search size={15} />
          {isLoading ? 'Looking up…' : 'Look up schedule'}
        </button>
      </form>

      {error && (
        <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700'>
          {error.message ?? 'Unable to load schedule'}
        </p>
      )}

      {isLoading ? (
        <p className='text-sm text-text-secondary'>Loading schedule...</p>
      ) : items.length === 0 && !error && section.trim() ? (
        <p className='text-sm text-text-secondary'>
          No schedules found for this section.
        </p>
      ) : items.length > 0 ? (
        <div className='rounded-card border border-border bg-surface p-6'>
          <h2 className='mb-4 text-md font-medium text-text-primary'>
            Schedule for {section}
          </h2>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border text-left text-text-secondary'>
                  <th className='px-4 py-2.5 font-normal'>Course</th>
                  <th className='px-4 py-2.5 font-normal'>Component</th>
                  <th className='px-4 py-2.5 font-normal'>Day</th>
                  <th className='px-4 py-2.5 font-normal'>Time</th>
                  <th className='px-4 py-2.5 font-normal'>Room</th>
                  <th className='px-4 py-2.5 font-normal'>Section</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className='border-b border-border-light'>
                    <td className='px-4 py-3 text-text-primary'>
                      {s.course_assignment?.course?.code}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {s.course_component?.label}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {DAY_LABELS[s.day_of_week] ?? s.day_of_week}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {s.start_time}
                      {s.end_time ? ` - ${s.end_time}` : ''}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {s.room?.code}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {s.section?.code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
