// pages/registrar/RegistrarTeacherAssignment.tsx
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { ClassScheduleModal } from '../../components/shared/ClassScheduleModal';
import {
  useAllSchedules,
  useCourseAssignmentsByTeacher,
  useCourses,
  useRooms,
  useSections,
  useTeachers,
} from '../../hooks/Schedule.hooks';
import { ModeBadge } from '../../components/shared/ModeBadge';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import type {
  CourseAssignmentDetail,
  Schedule,
  TeacherListItem,
} from '../../types/Types';

type ModalTarget =
  | { mode: 'create'; assignment: CourseAssignmentDetail }
  | { mode: 'edit'; schedule: Schedule };

export default function RegistrarTeacherAssignment() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const id = teacherId ? Number(teacherId) : undefined;

  const {
    data: teachers,
    isLoading: teachersLoading,
  } = useTeachers({ enabled: true });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useCourseAssignmentsByTeacher({
    teacherId: id,
    enabled: !!id,
  });

  const {
    data: rooms,
    isLoading: roomsLoading,
  } = useRooms({ enabled: true });

  const { data: courses } = useCourses();
  const { data: sections } = useSections();

  // Active run id for creating a single scheduled class.
  const {
    data: allSchedules,
    isLoading: schedulesLoading,
  } = useAllSchedules({ enabled: true });
  const runId = allSchedules?.[0]?.run ?? null;

  const teacher: TeacherListItem | undefined =
    teachers?.find((t) => t.id === id);

  const teacherAssignments: CourseAssignmentDetail[] = assignments ?? [];

  const loading =
    teachersLoading || assignmentsLoading || roomsLoading || schedulesLoading;

  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const scheduleFor = (assignment: CourseAssignmentDetail) =>
    (allSchedules ?? []).find(
      (schedule) => schedule.assignment === assignment.id
    );

  const openModal = (assignment: CourseAssignmentDetail) => {
    setNotification(null);

    const schedule = scheduleFor(assignment);
    if (schedule) {
      setModalTarget({ mode: 'edit', schedule });
      return;
    }

    if (!runId) {
      setNotification({
        type: 'error',
        message:
          'No active schedule run available. Generate a schedule first.',
      });
      return;
    }

    setModalTarget({ mode: 'create', assignment });
  };

  const closeModal = () => setModalTarget(null);

  const clearNotification = () => setNotification(null);

  if (loading) {
    return (
      <section className='w-full p-6'>
        <p className='text-sm text-text-secondary'>Loading teacher assignments…</p>
      </section>
    );
  }

  if (assignmentsError) {
    return (
      <section className='w-full p-6'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm font-medium text-red-700 mb-2'>
            Failed to load assignments.
          </p>
          <p className='text-xs text-red-600 mb-3'>
            {assignmentsError.message ?? 'Unable to load data from the API.'}
          </p>
        </div>
      </section>
    );
  }

  if (id === undefined) {
    return (
      <section className='w-full'>
        <div className='mb-5 flex items-center gap-2'>
          <Link
            to='/registrar/teachers'
            className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={15} /> Back to teachers
          </Link>
          <h1 className='text-lg font-medium text-text-primary ml-auto'>
            Teacher Assignments
          </h1>
        </div>
        <p className='text-sm text-text-secondary'>No teacher selected.</p>
      </section>
    );
  }

  if (!teacher) {
    return (
      <section className='w-full'>
        <div className='mb-5 flex items-center gap-2'>
          <Link
            to='/registrar/teachers'
            className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={15} /> Back to teachers
          </Link>
          <h1 className='text-lg font-medium text-text-primary ml-auto'>
            Teacher Assignments
          </h1>
        </div>
        <p className='text-sm text-text-secondary'>Teacher not found.</p>
      </section>
    );
  }

  if (teacherAssignments.length === 0) {
    return (
      <section className='w-full'>
        <div className='mb-5 flex items-center gap-2'>
          <Link
            to='/registrar/teachers'
            className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={15} /> Back to teachers
          </Link>
          <h1 className='text-lg font-medium text-text-primary ml-auto'>
            Teacher Assignments
          </h1>
        </div>
        <div className='rounded-card border border-border bg-surface p-8 text-center'>
          <EmptyState
            icon={
              <svg className='w-8 h-8 text-current' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M3 10h18M3 14h18m-9-4v8m-4 4h18m-11 0v8m0 0h18m-18 0h18' />
              </svg>
            }
            title='No assignments found'
            description={`No assignments for ${teacher.full_name || teacher.username}.`}
          />
        </div>
      </section>
    );
  }

  return (
    <section className='w-full'>
      <div className='mb-5 flex items-center gap-2'>
        <Link
          to='/registrar/teachers'
          className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <ArrowLeft size={15} /> Back to teachers
        </Link>
        <h1 className='text-lg font-medium text-text-primary ml-auto'>
          Teacher Assignments
        </h1>
      </div>

      {notification && (
        <div
          className={`rounded-lg border p-3 mb-4 text-sm flex items-start gap-3 ${
            notification.type === 'success'
              ? 'bg-apple-green-50 border-apple-green-100 text-apple-green-700'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
          role='alert'
        >
          <span className='shrink-0 mt-0.5'>
            {notification.type === 'success' ? '✓' : '✕'}
          </span>
          <p className='text-text-primary'>{notification.message}</p>
          <button
            type='button'
            onClick={clearNotification}
            className='ml-auto text-text-tertiary hover:text-text-primary'
          >
            ✕
          </button>
        </div>
      )}

      <div className='overflow-hidden rounded-card border border-border bg-surface'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-text-secondary'>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Teacher
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Course
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Section
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Program
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Type
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Status
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal text-right'>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {teacherAssignments.map((a: CourseAssignmentDetail) => {
              const scheduledClass = scheduleFor(a);

              return (
                <tr
                  key={a.id}
                  className='border-t border-border cursor-pointer hover:bg-surface-secondary transition'
                >
                  <td
                    className='px-4 py-3 text-text-primary'
                    onClick={() => openModal(a)}
                  >
                    {a.prof_name}
                  </td>
                  <td
                    className='px-4 py-3 text-text-primary'
                    onClick={() => openModal(a)}
                  >
                    {a.subject_label}
                  </td>
                  <td
                    className='px-4 py-3 text-text-secondary'
                    onClick={() => openModal(a)}
                  >
                    {a.section_name}
                  </td>
                  <td
                    className='px-4 py-3 text-text-secondary'
                    onClick={() => openModal(a)}
                  >
                    {a.section_name}
                  </td>
                  <td
                    className='px-4 py-3 text-text-secondary'
                    onClick={() => openModal(a)}
                  >
                    <ModeBadge mode={a.meetings?.[0]?.mode_display} />
                  </td>
                  <td className='px-4 py-3 text-text-secondary' onClick={() => openModal(a)}>
                    <StatusBadge status={scheduledClass ? 'scheduled' : 'unscheduled'} />
                  </td>
                  <td
                    className='px-4 py-3 text-right'
                    onClick={() => openModal(a)}
                  >
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(a);
                      }}
                      className='inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {scheduledClass ? 'Reschedule' : 'Schedule'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalTarget?.mode === 'create' && runId && (
        <ClassScheduleModal
          mode='create'
          runId={runId}
          assignment={modalTarget.assignment}
          professors={teachers ?? []}
          courses={courses ?? []}
          sections={sections ?? []}
          rooms={rooms ?? []}
          onClose={closeModal}
          onSaved={() =>
            setNotification({
              type: 'success',
              message: 'Schedule created successfully.',
            })
          }
        />
      )}

      {modalTarget?.mode === 'edit' && (
        <ClassScheduleModal
          mode='edit'
          runId={modalTarget.schedule.run}
          schedule={modalTarget.schedule}
          professors={teachers ?? []}
          courses={courses ?? []}
          sections={sections ?? []}
          rooms={rooms ?? []}
          onClose={closeModal}
          onSaved={() =>
            setNotification({
              type: 'success',
              message: 'Schedule updated successfully.',
            })
          }
          onDeleted={() =>
            setNotification({
              type: 'success',
              message: 'Scheduled class deleted.',
            })
          }
        />
      )}
    </section>
  );
}
