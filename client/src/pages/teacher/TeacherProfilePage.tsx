// pages/teacher/TeacherProfilePage.tsx
import { BookOpen, Clock, Calendar, Building2 } from 'lucide-react';
import { useMe } from '../../hooks/useAuth';
import { useProfessorProfile } from '../../hooks/Schedule.hooks';
import { SectionHeader } from '../../components/shared/SectionHeader';
import { StatTile } from '../../components/shared/StatTile';

export default function TeacherProfilePage() {
  const { data: user, isLoading } = useMe({ enabled: true });
  const { data: profile } = useProfessorProfile();

  const assignments = profile?.assignments ?? [];
  const weeklyHours = assignments.reduce(
    (total, assignment) =>
      total +
      assignment.meetings.reduce(
        (meetingTotal, meeting) => meetingTotal + meeting.duration_slots,
        0
      ),
    0
  );

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Professor';
  const department =
    profile?.department?.name ?? user?.professor?.department ?? '—';

  if (isLoading) {
    return (
      <section className='w-full'>
        <p className='text-sm text-text-secondary'>Loading profile…</p>
      </section>
    );
  }

  return (
    <section className='w-full'>
      <SectionHeader title='My Profile' />

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <StatTile
          icon={<BookOpen size={16} />}
          label='Assigned courses'
          value={assignments.length}
        />
        <StatTile
          icon={<Clock size={16} />}
          label='Weekly hours'
          value={`${weeklyHours} hrs`}
        />
        <StatTile
          icon={<Calendar size={16} />}
          label='Max daily hours'
          value={profile?.max_daily_hours ?? user?.professor?.max_daily_hours ?? '—'}
        />
      </div>

      <div className='mt-6 rounded-2xl border border-border bg-surface p-6'>
        <h2 className='text-sm font-medium text-text-primary mb-4'>
          Account Details
        </h2>
        <dl className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <dt className='text-xs uppercase tracking-wide text-text-tertiary'>
              Full name
            </dt>
            <dd className='mt-1 text-sm font-medium text-text-primary'>
              {fullName}
            </dd>
          </div>
          <div>
            <dt className='text-xs uppercase tracking-wide text-text-tertiary'>
              Username
            </dt>
            <dd className='mt-1 text-sm font-medium text-text-primary'>
              {user?.username ?? '—'}
            </dd>
          </div>
          <div>
            <dt className='text-xs uppercase tracking-wide text-text-tertiary'>
              Email
            </dt>
            <dd className='mt-1 text-sm font-medium text-text-primary'>
              {user?.email ?? '—'}
            </dd>
          </div>
          <div>
            <dt className='text-xs uppercase tracking-wide text-text-tertiary'>
              Role
            </dt>
            <dd className='mt-1 text-sm font-medium capitalize text-text-primary'>
              {user?.role ?? 'professor'}
            </dd>
          </div>
          <div>
            <dt className='text-xs uppercase tracking-wide text-text-tertiary'>
              Department
            </dt>
            <dd className='mt-1 flex items-center gap-2 text-sm font-medium text-text-primary'>
              <Building2 size={14} className='text-text-tertiary' />
              {department}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
