import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui';

export interface CourseCardProps {
  id: number;
  code: string;
  title: string;
  section: string;
  studentCount: number;
  label: string;
  scheduled: boolean;
}

export default function CourseCard({
  id,
  code,
  title,
  section,
  studentCount,
  label,
  scheduled,
}: CourseCardProps) {
  const { name: teacherName } = useParams<{ name: string }>();
  const teacher = teacherName ?? 'juan';

  return (
    <Link
      to={`/teacher/${teacher}/assignments/${id}`}
      className='group flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 transition hover:border-apple-green-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-green-600'
    >
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h3 className='text-h3 text-text-primary'>{code}</h3>
          {title !== code && (
            <p className='mt-0.5 text-body-sm text-text-secondary'>{title}</p>
          )}
        </div>
        <Badge tone={scheduled ? 'success' : 'warning'}>
          {label} · {scheduled ? 'Scheduled' : 'Pending'}
        </Badge>
      </div>

      <dl className='grid grid-cols-2 gap-4 border-t border-border-light pt-4'>
        <div>
          <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
            Section
          </dt>
          <dd className='mt-0.5 text-body-sm font-medium text-text-primary'>
            {section}
          </dd>
        </div>
        <div>
          <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
            Students
          </dt>
          <dd className='mt-0.5 text-body-sm font-medium text-text-primary tabular-nums'>
            {studentCount || '—'}
          </dd>
        </div>
      </dl>

      <span className='mt-auto inline-flex min-h-11 items-center gap-1.5 text-body-sm font-medium text-apple-green-700'>
        View details
        <ArrowRight
          size={15}
          className='transition-transform group-hover:translate-x-0.5'
          aria-hidden='true'
        />
      </span>
    </Link>
  );
}
