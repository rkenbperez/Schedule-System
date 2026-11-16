// pages/teacher/TeacherAssingmentDetailPage.tsx
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCourseComponents } from '../../hooks/Schedule.hooks';
import type { CourseAssignmentDetail } from '../../types/Types';

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

export default function TeacherAssingmentDetailPage() {
  const { name: teacherName, 'assignment-id': assignmentIdStr } = useParams();
  const assignmentId = assignmentIdStr ? Number(assignmentIdStr) : NaN;
  const navigate = useNavigate();
  const teacher = teacherName ?? 'juan';

  const assignment = exampleAssignments.find((a) => a.id === assignmentId);

  const { data: components } = useCourseComponents({
    enabled: !!assignment?.subject,
  });

  const resolvedComponents = components?.filter(
    (c: CourseComponent) => c.course.id === assignment?.subject
  ) ?? [];

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
        to={`/teacher/${teacher}/assignments`}
        className='mb-4 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
      >
        <ArrowLeft size={15} />
        Back to my assignments
      </Link>

      <h1 className='text-lg font-medium text-text-primary'>
        {assignment.subject_label}
      </h1>
      <p className='mb-6 text-sm text-text-secondary'>
        {assignment.subject_label}
      </p>

      <div className='mb-6 rounded-card border border-border bg-surface p-4'>
        <dl className='grid grid-cols-2 gap-y-3 text-sm'>
          <dt className='text-text-tertiary'>Section</dt>
          <dd className='text-text-primary'>{assignment.section_name}</dd>

          <dt className='text-text-tertiary'>Students</dt>
          <dd className='text-text-primary'>—</dd>
        </dl>
      </div>

      <h2 className='mb-3 text-sm font-medium text-text-primary'>Components</h2>
      <div className='flex flex-col gap-3'>
        {resolvedComponents.map((component) => {
          const isScheduled = Boolean(component.is_active);
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
                      `/teacher/${teacher}/assignments/${assignment.id}/create-schedule?component=${component.id}`
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
