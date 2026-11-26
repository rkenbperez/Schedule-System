import { BookOpen } from 'lucide-react';
import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import CourseCard from './components/CourseCard';
import {
  Alert,
  Badge,
  CardSkeleton,
  EmptyState,
  PageHeader,
} from '../../components/ui';

export default function TeacherAssignmentPage() {
  const { data: user } = useMe({
    enabled: true,
  });

  const teacherId = user?.professor?.id;

  const {
    data: assignments,
    isLoading,
    isError,
  } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });

  const { data: schedules } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const resolvedAssignments = assignments ?? [];
  const resolvedSchedules = schedules ?? [];

  const isScheduled = (assignmentId: number) =>
    resolvedSchedules.some((schedule) => schedule.assignment === assignmentId);

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title='My assignments'
        description='1st semester, 2026 to 2027'
      />

      <div className='flex flex-wrap items-center gap-2'>
        <Badge tone='success'>Scheduled</Badge>
        <Badge tone='warning'>Pending</Badge>
      </div>

      {isLoading ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <Alert tone='danger' title='Unable to load your courses'>
          Please refresh the page or try again later.
        </Alert>
      ) : resolvedAssignments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title='No courses assigned yet'
          description='Assignments will appear here once the registrar adds you to a course.'
        />
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {resolvedAssignments.map((assignment) => (
            <CourseCard
              key={assignment.id}
              id={assignment.id}
              code={assignment.subject_label}
              title={assignment.subject_label}
              section={assignment.section_name}
              studentCount={assignment.section_headcount}
              label={assignment.meetings?.[0]?.mode_display || assignment.subject_label}
              scheduled={isScheduled(assignment.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
