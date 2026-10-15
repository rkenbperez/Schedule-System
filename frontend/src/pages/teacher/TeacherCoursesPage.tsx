import { useCourseAssignments, useSchedules } from '../../hooks/Schedule.hooks';
import CourseCard from './components/CourseCard';

export default function TeacherCoursesPage() {
  const teacherId = 1; // TEMP: hardcoded so courses are viewable without login

  const {
    data: assignments,
    isLoading,
    isError,
  } = useCourseAssignments({
    teacherId,
  });

  const { data: schedules } = useSchedules({ teacherId });

  const isScheduled = (assignmentId: number) =>
    schedules?.some(
      (schedule) => schedule.course_assignment.id === assignmentId
    ) ?? false;

  return (
    <section className='w-full'>
      {/* Page Header */}
      <p className='mb-6 text-sm text-text-secondary'>
        1st semester, 2026 to 2027
      </p>

      <div className='mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary'>
        <div className='flex items-center gap-1.5'>
          <span className='inline-block h-2.5 w-2.5 rounded-full border border-apple-green-400 bg-apple-green-500' />
          Scheduled
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='inline-block h-2.5 w-2.5 rounded-full border border-amber-400 bg-amber-500' />
          Not scheduled
        </div>
      </div>

      {isLoading ? (
        <p className='text-sm text-text-secondary'>Loading courses...</p>
      ) : isError ? (
        <p className='text-sm text-text-secondary'>
          Unable to load your courses.
        </p>
      ) : !assignments || assignments.length === 0 ? (
        <p className='text-sm text-text-secondary'>No courses assigned yet.</p>
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {assignments.map((assignment) => (
            <CourseCard
              key={assignment.id}
              id={assignment.id}
              code={assignment.course.code}
              title={assignment.course.title}
              section={assignment.section.code}
              studentCount={assignment.section.student_count}
              label={assignment.type}
              scheduled={isScheduled(assignment.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
