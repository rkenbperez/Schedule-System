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
import type { CourseAssignmentDetail, Schedule } from '../../types/Types';

// Mock example data for testing without backend.
const exampleAssignments: CourseAssignmentDetail[] = [
  {
    id: 1,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [{ id: 1, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Juan Dela Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 2,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [{ id: 2, order: 2, mode: 'lab', mode_display: 'Laboratory', duration_slots: 4 }],
    prof_name: 'Juan Dela Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 3,
    prof: 1,
    subject: 2,
    section: 2,
    term: 1,
    meetings: [{ id: 3, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Juan Dela Cruz',
    subject_label: 'DCIT 5',
    section_name: '2-B',
  },
];

const exampleSchedules: Schedule[] = [
  {
    id: 1,
    run: 1,
    assignment: 1,
    assignment_label: 'COSC 7 - 3-A',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7',
    room: 101,
    room_name: 'Room 101',
    day: 0,
    day_display: 'Monday',
    start_time: '07:00',
    end_time: '09:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
];

export default function TeacherAssignmentPage() {
  const { data: user } = useMe({
    enabled: true,
  });

  const teacherId = user?.professor?.id;

  const mockAssignments: CourseAssignmentDetail[] = exampleAssignments;
  const mockSchedules: Schedule[] = exampleSchedules;

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

  const resolvedAssignments = assignments ?? mockAssignments;
  const resolvedSchedules = schedules ?? mockSchedules;

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
              studentCount={0}
              label={assignment.meetings?.[0]?.mode_display || assignment.subject_label}
              scheduled={isScheduled(assignment.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
