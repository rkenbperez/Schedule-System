// pages/teacher/TeacherCourseDetailsPage.tsx
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCourseAssignments, useCourseComponents } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';

export default function TeacherCourseDetailsPage() {
  const { 'course-assigment-id': assignmentIdStr } = useParams();
  const assignmentId = assignmentIdStr ? Number(assignmentIdStr) : NaN;
  const navigate = useNavigate();

  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.teacher_profile?.id;

  const {
    data: assignments,
    isLoading: assignmentsLoading,
  } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });

  const assignment = assignments?.find((a) => a.id === assignmentId);

  const {
    data: components,
    isLoading: componentsLoading,
  } = useCourseComponents({
    courseId: assignment?.course.id,
    enabled: !!assignment?.course.id,
  });

  if (assignmentsLoading || componentsLoading) {
    return (
      <section className='w-full max-w-2xl'>
        <p className='text-sm text-text-secondary'>Loading course...</p>
      </section>
    );
  }

  if (!assignment) {
    return (
      <section className='w-full max-w-2xl'>
        <p className='text-sm text-text-secondary'>Course not found.</p>
      </section>
    );
  }

  return (
    <section className='w-full max-w-2xl'>
      <Link
        to='/teacher/juan/courses'
        className='mb-4 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
      >
        <ArrowLeft size={15} />
        Back to my courses
      </Link>

      <h1 className='text-lg font-medium text-text-primary'>
        {assignment.course.code}
      </h1>
      <p className='mb-6 text-sm text-text-secondary'>
        {assignment.course.title}
      </p>

      <div className='mb-6 rounded-card border border-border bg-surface p-4'>
        <dl className='grid grid-cols-2 gap-y-3 text-sm'>
          <dt className='text-text-tertiary'>Section</dt>
          <dd className='text-text-primary'>{assignment.section.code}</dd>

          <dt className='text-text-tertiary'>Students</dt>
          <dd className='text-text-primary'>{assignment.section.student_count}</dd>
        </dl>
      </div>

      <h2 className='mb-3 text-sm font-medium text-text-primary'>Components</h2>
      <div className='flex flex-col gap-3'>
        {(components ?? []).map((component) => {
          const isScheduled = Boolean(component.scheduled);
          return (
            <div
              key={component.id}
              className='flex items-center justify-between rounded-card border border-border bg-surface p-4'
            >
              <div className='flex items-center gap-3'>
                {isScheduled ? (
                  <Check size={18} className='text-apple-green-600' />
                ) : (
                  <Clock size={18} className='text-amber-600' />
                )}
                <div>
                  <p className='text-sm font-medium text-text-primary'>
                    {component.label}
                  </p>
                  {isScheduled ? (
                    <p className='text-xs text-text-secondary sm:text-sm'>
                      Scheduled
                    </p>
                  ) : (
                    <p className='text-xs text-text-secondary sm:text-sm'>
                      Not scheduled yet
                    </p>
                  )}
                </div>
              </div>

              {isScheduled ? (
                <span className='rounded-full bg-apple-green-50 px-2.5 py-1 text-[10px] font-medium text-apple-green-700 sm:text-xs'>
                  Scheduled
                </span>
              ) : (
                <button
                  onClick={() =>
                    navigate(
                      `/teacher/juan/create-schedule/${assignmentId}?component=${component.id}`
                    )
                  }
                  className='rounded-md bg-apple-green-400 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-apple-green-600'
                >
                  Select schedule
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
