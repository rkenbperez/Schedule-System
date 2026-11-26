import { BookOpen, CalendarDays, Clock } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import DashboardCourseCard from './components/DashboardCourseCard';
import {
  CardSkeleton,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
} from '../../components/ui';

export default function TeacherDashboard() {
  const { name } = useParams<{ name: string }>();
  const { data: user } = useMe({ enabled: true });
  const teacher = name ?? user?.username ?? '';
  const teacherId = user?.professor?.id;

  const { data: assignments, isLoading: assignmentsLoading } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });

  const { data: schedules, isLoading: schedulesLoading } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const resolvedAssignments = assignments ?? [];
  const resolvedSchedules = schedules ?? [];

  const unscheduledCount = resolvedAssignments.filter(
    (assignment) =>
      !resolvedSchedules.some((schedule) => schedule.assignment === assignment.id)
  ).length;

  const loading = assignmentsLoading || schedulesLoading;

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title='Dashboard'
        description='1st semester, 2026 to 2027'
      />

      {loading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            <StatCard
              icon={BookOpen}
              label='Assigned courses'
              value={resolvedAssignments.length}
              hint='Across all sections'
            />
            <StatCard
              icon={Clock}
              label='Unscheduled'
              value={unscheduledCount}
              hint='Needs a timetable slot'
            />
            <StatCard
              icon={CalendarDays}
              label='Classes today'
              value={resolvedSchedules.length}
              hint='Scheduled meetings'
            />
          </div>

          <section className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <h2 className='text-h2 text-text-primary'>My courses</h2>
                <p className='text-body-sm text-text-secondary'>
                  Your scheduled classes this term
                </p>
              </div>
              <LinkButton to={`/teacher/${teacher}/assignments`} variant='secondary' size='sm'>
                View all assignments
              </LinkButton>
            </div>

            {resolvedSchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title='No classes scheduled yet'
                description='Your scheduled classes will appear here once the registrar publishes the timetable.'
                action={
                  <LinkButton to={`/teacher/${teacher}/assignments`} variant='secondary'>
                    View my assignments
                  </LinkButton>
                }
              />
            ) : (
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                {resolvedSchedules.map((schedule) => (
                  <DashboardCourseCard key={schedule.id} schedule={schedule} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
