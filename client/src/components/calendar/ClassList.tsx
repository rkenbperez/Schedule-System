// components/calendar/ClassList.tsx
import { ModeBadge } from '../../components/shared/ModeBadge';
import { formatCompactTime } from '../../utils/timeMapping';
import type { PublicClass } from '../../types/Types';

interface ClassListProps {
  classes: PublicClass[];
}

export function ClassList({ classes }: ClassListProps) {
  const sorted = [...classes].sort((a: PublicClass, b: PublicClass) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start_time.localeCompare(b.start_time);
  });

  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className='rounded-card border border-border bg-surface overflow-hidden'>
      <table className='w-full text-xs'>
        <thead className='sticky top-0 z-10 bg-surface border-b border-border'>
          <tr className='text-left text-[10px] text-text-secondary uppercase'>
            <th className='px-3 py-2'>Day</th>
            <th className='px-3 py-2'>Time</th>
            <th className='px-3 py-2'>Course</th>
            <th className='px-3 py-2'>Section</th>
            <th className='px-3 py-2'>Professor</th>
            <th className='px-3 py-2'>Room</th>
            <th className='px-3 py-2'>Mode</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cls: PublicClass) => (
            <tr key={cls.id} className='border-b border-border-light hover:bg-surface-secondary'>
              <td className='px-3 py-2 text-text-secondary'>{DAY_LABELS[cls.day]}</td>
              <td className='px-3 py-2 text-text-secondary'>
                {formatCompactTime(cls.start_time, cls.end_time)}
              </td>
              <td className='px-3 py-2 text-text-primary truncate max-w-[120px]'>
                {cls.subject.code} - {cls.subject.title}
              </td>
              <td className='px-3 py-2 text-text-secondary truncate'>
                {cls.section.name}
              </td>
              <td className='px-3 py-2 text-text-secondary truncate'>
                {cls.professor.name}
              </td>
              <td className='px-3 py-2 text-text-secondary truncate'>
                {cls.room?.name ?? 'Unassigned'}
              </td>
              <td className='px-3 py-2'>
                <ModeBadge mode={cls.mode_display} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
