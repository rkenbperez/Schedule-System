import { BookOpen, Clock, Calendar } from 'lucide-react';

import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import StatCard from './components/StatCard';
import DashboardCourseCard from './components/DashboardCourseCard';

export default function TeacherDashboard() {
  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.teacher_profile?.id;

  const {
    data: assignments,
    isLoading: assignmentsLoading,
  } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });

  const { data: schedules, isLoading: schedulesLoading } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const unscheduledCount = assignments?.filter((a) => !a.scheduled).length ?? 0;

  const loading = assignmentsLoading || schedulesLoading;

  return (
    <section className='w-full'>
      {loading ? (
        <p className='text-sm text-text-secondary'>Loading...</p>
      ) : (
        <>
          <p className='mb-6 text-sm text-text-secondary'>
            1st semester, 2026 to 2027
          </p>

          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            <StatCard
              icon={<BookOpen size={16} />}
              label='Assigned courses'
              value={assignments?.length ?? 0}
            />

            <StatCard
              icon={<Clock size={16} />}
              label='Unscheduled'
              value={unscheduledCount}
              variant='warning'
            />

            <StatCard
              icon={<Calendar size={16} />}
              label='Classes today'
              value={schedules?.length ?? 0}
            />
          </div>

          <section className='flex flex-col py-5'>
            <h2 className='pb-5 text-md font-medium tracking-tight text-text-primary'>
              My courses
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
              {(schedules ?? []).map((schedule) => (
                <DashboardCourseCard key={schedule.id} schedule={schedule} />
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
