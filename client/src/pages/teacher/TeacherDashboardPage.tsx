import { BookOpen, Clock, Calendar } from 'lucide-react';

import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import StatCard from './components/StatCard';
import DashboardCourseCard from './components/DashboardCourseCard';
import type {
  CourseAssignmentDetail,
  Schedule,
} from '../../types/Types';

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
  {
    id: 2,
    run: 1,
    assignment: 3,
    assignment_label: 'DCIT 5 - 2-B',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 2,
    section_name: '2-B',
    subject_label: 'DCIT 5',
    room: 102,
    room_name: 'Room 204',
    day: 1,
    day_display: 'Tuesday',
    start_time: '10:00',
    end_time: '12:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
];

export default function TeacherDashboard() {
  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.professor?.id;

  const mockAssignments: CourseAssignmentDetail[] = exampleAssignments;
  const mockSchedules: Schedule[] = exampleSchedules;

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

  const resolvedAssignments = assignments ?? mockAssignments;
  const resolvedSchedules = schedules ?? mockSchedules;

  const unscheduledCount = resolvedAssignments.filter(
    (a) => !resolvedSchedules.some((s) => s.assignment === a.id)
  ).length;

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
              value={resolvedAssignments.length}
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
              value={resolvedSchedules.length}
            />
          </div>

          <section className='flex flex-col py-5'>
            <h2 className='pb-5 text-md font-medium tracking-tight text-text-primary'>
              My courses
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
              {resolvedSchedules.map((schedule) => (
                <DashboardCourseCard key={schedule.id} schedule={schedule} />
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
