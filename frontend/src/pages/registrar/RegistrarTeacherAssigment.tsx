import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  DAY_LABELS,
  initialTeachers,
  type CourseOffering,
} from './registrarData';
import AssignCourseModal from './components/AssignCourseModal';

export default function RegistrarTeacherAssigment() {
  const { teacherId } = useParams();

  const teacher = initialTeachers.find((t) => String(t.id) === teacherId);

  const [assignments, setAssignments] = useState(
    () => teacher?.assignments ?? []
  );

  const [isAssignOpen, setIsAssignOpen] = useState(false);

  if (!teacher) {
    return (
      <section className='w-full'>
        <Link
          to='/registrar'
          className='mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </Link>
        <p className='text-sm text-text-secondary'>Teacher not found.</p>
      </section>
    );
  }

  const pendingCount = assignments.filter((a) => !a.scheduled).length;

  const handleAssign = (offerings: CourseOffering[]) => {
    if (offerings.length === 0) return;

    const added = offerings.map((offering) => ({
      id: offering.id,
      course_code: offering.course_code,
      course_title: offering.course_title,
      section_code: offering.section_code,
      label: offering.label,
      scheduled: false,
    }));

    setAssignments([...assignments, ...added]);
    setIsAssignOpen(false);
  };

  return (
    <section className='w-full'>
      <Link
        to='/registrar'
        className='mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      {/* Header + actions */}
      <div className='mb-5 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-lg font-medium text-text-primary'>
            {teacher.full_name}
          </h1>
          <p className='text-sm text-text-secondary'>
            {teacher.department_name} · {assignments.length}{' '}
            {assignments.length === 1 ? 'assignment' : 'assignments'}
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={() => setIsAssignOpen(true)}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            <Plus size={14} />
            Assign
          </button>
        </div>
      </div>

      {pendingCount === 0 && (
        <p className='mb-4 text-xs text-apple-green-700'>
          All meetings for this teacher are scheduled.
        </p>
      )}

      {/* Assignments table */}
      <div className='overflow-hidden rounded-card border border-border bg-surface'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-text-secondary'>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Course
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Section
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Meeting
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Schedule
              </th>
              <th scope='col' className='px-4 py-2.5 text-right font-normal'>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className='border-t border-border'>
                <td className='px-4 py-3 align-top'>
                  <div className='flex flex-col'>
                    <span className='font-medium text-text-primary'>
                      {assignment.course_code}
                    </span>
                    <span className='text-xs text-text-tertiary'>
                      {assignment.course_title}
                    </span>
                  </div>
                </td>
                <td className='px-4 py-3 align-top text-text-secondary'>
                  {assignment.section_code}
                </td>
                <td className='px-4 py-3 align-top capitalize text-text-primary'>
                  {assignment.label}
                </td>
                <td className='px-4 py-3 align-top text-text-secondary'>
                  {assignment.scheduled && assignment.day_of_week != null
                    ? `${DAY_LABELS[assignment.day_of_week]}, ${
                        assignment.time_slot_label
                      } · ${assignment.room}`
                    : '—'}
                </td>
                <td className='px-4 py-3 text-right align-top'>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-xs ${
                      assignment.scheduled
                        ? 'bg-apple-green-50 text-apple-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {assignment.scheduled ? 'Scheduled' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAssignOpen && (
        <AssignCourseModal
          department={teacher.department_name}
          existing={assignments}
          onClose={() => setIsAssignOpen(false)}
          onAssign={handleAssign}
        />
      )}
    </section>
  );
}
