// pages/teacher/TeacherDashboardPage.tsx
import { BookOpen, Clock, Calendar, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';

import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import { StatTile } from '../../components/shared/StatTile';
import { SectionHeader } from '../../components/shared/SectionHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { SkeletonCard } from '../../components/shared/Skeleton';
import CourseCard from './components/CourseCard';
import { AssignmentDetailPanel } from './TeacherAssignmentPage';
import type {
  CourseAssignmentDetail,
  Schedule,
} from '../../types/Types';

const splitSubject = (label: string) => {
  const parts = label.split(' - ');
  return {
    code: parts[0] ?? '',
    title: parts.slice(1).join(' - '),
  };
};

const CARDS_PER_PAGE = 6;

export default function TeacherDashboard() {
  const { data: user } = useMe({ enabled: true });
  const { name: teacherName } = useParams<{ name: string }>();
  const teacher = teacherName ?? 'juan';
  const teacherId = user?.professor?.id;

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

  const resolvedAssignments: CourseAssignmentDetail[] = useMemo(
    () => assignments ?? [],
    [assignments]
  );
  const resolvedSchedules: Schedule[] = useMemo(() => schedules ?? [], [
    schedules,
  ]);

  // Map JS getDay() (0=Sunday) to Monday-indexed weekday:
  // 0=Monday ... 5=Saturday, 6=Sunday (returns 0 classes since no day=6 exists)
  const todayIdx = (new Date().getDay() + 6) % 7;
  const classesToday = resolvedSchedules.filter((s) => s.day === todayIdx).length;
  const totalThisWeek = resolvedSchedules.length;

  const scheduledAssignmentIds = new Set(
    resolvedSchedules.map((s) => s.assignment)
  );
  const unscheduledCount = resolvedAssignments.filter(
    (a) => !scheduledAssignmentIds.has(a.id)
  ).length;

  const loading = assignmentsLoading || schedulesLoading;

  // Slide-over panel state
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);
  // Carousel state — starts at page 1 (index 0)
  const [carouselPage, setCarouselPage] = useState(0);

  const openAssignment =
    openAssignmentId !== null
      ? resolvedAssignments.find((a) => a.id === openAssignmentId)
      : undefined;

  const totalPages = Math.max(1, Math.ceil(resolvedAssignments.length / CARDS_PER_PAGE));
  const paginatedAssignments = useMemo(() => {
    const start = carouselPage * CARDS_PER_PAGE;
    return resolvedAssignments.slice(start, start + CARDS_PER_PAGE);
  }, [resolvedAssignments, carouselPage]);

  const canPrev = carouselPage > 0;
  const canNext = carouselPage < totalPages - 1;

  if (loading) {
    return (
      <section className='w-full'>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className='flex flex-col py-5'>
          <SectionHeader title='My courses' />
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className='w-full'>
      <p className='mb-6 text-sm text-text-secondary'>
        1st semester, 2026 to 2027
      </p>

      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
        <StatTile
          icon={<BookOpen size={16} />}
          label='Assigned courses'
          value={resolvedAssignments.length}
        />

        <StatTile
          icon={<Clock size={16} />}
          label='Unscheduled'
          value={unscheduledCount}
          tone='warning'
        />

        <StatTile
          icon={<Calendar size={16} />}
          label='Classes today'
          value={classesToday}
          subtitle={totalThisWeek > 0 ? `${totalThisWeek} total this week` : undefined}
        />
      </div>

      <section className='flex flex-col py-5'>
        <SectionHeader
          title='My courses'
          action={
            <div className='flex items-center gap-2'>
              {totalPages > 1 && (
                <>
                  <button
                    type='button'
                    onClick={() => setCarouselPage((p) => Math.max(0, p - 1))}
                    disabled={!canPrev}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-secondary'
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className='text-xs text-text-secondary'>
                    Page {carouselPage + 1} of {totalPages}
                  </span>
                  <button
                    type='button'
                    onClick={() => setCarouselPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={!canNext}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-secondary'
                  >
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              <Link
                to={`/teacher/${teacher}/assignments`}
                className='text-xs font-medium text-apple-green-600 hover:text-apple-green-700 flex items-center gap-1'
              >
                View all assignments
                <ArrowRight size={14} />
              </Link>
            </div>
          }
        />

        {resolvedAssignments.length === 0 ? (
          <EmptyState
            icon={
              <svg className='w-8 h-8 text-current' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M3 10h18M3 14h18m-9-4v8m-4 4h18m-11 0v8m0 0h18m-18 0h18m-18 0h18' />
              </svg>
            }
            title='No courses assigned yet.'
            description='Courses will appear here once they are assigned to you.'
            action={
              <Link
                to={`/teacher/${teacher}/assignments`}
                className='flex items-center gap-1.5 text-xs font-medium text-apple-green-600 hover:text-apple-green-700'
              >
                View all assignments
                <ArrowRight size={14} />
              </Link>
            }
          />
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {paginatedAssignments.map((assignment) => {
              const isScheduled = scheduledAssignmentIds.has(assignment.id);
              const { code, title } = splitSubject(assignment.subject_label);
              const modes = [
                ...new Set(
                  assignment.meetings
                    ?.map((m) => m.mode_display)
                    .filter(Boolean)
                ),
              ];
              return (
                <CourseCard
                  key={assignment.id}
                  id={assignment.id}
                  code={code}
                  title={title}
                  section={assignment.section_name}
                  modes={modes}
                  scheduled={isScheduled}
                  onViewDetails={() => setOpenAssignmentId(assignment.id)}
                />
              );
            })}
          </div>
        )}
      </section>

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
