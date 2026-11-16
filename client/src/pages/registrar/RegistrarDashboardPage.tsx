// pages/registrar/RegistrarDashboardPage.tsx
import type { ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  Clock,
  FileSpreadsheet,
  FileText,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
// import {
//   useAllSchedules,
//   useAllAssignments,
//   useTeachers,
// } from '../../hooks/Registrar.hooks';
import type {
  CourseAssignmentDetail,
  Schedule,
  TeacherListItem,
} from '../../types/Types';
import {
  registrarTeacherProfiles,
  registrarCourseAssignments,
  registrarSchedules,
} from './registrarData';
// import StatCard from '../teacher/components/StatCard';

/* ---------- small local pieces ---------- */

function StatTile({
  icon,
  label,
  value,
  tone = 'success',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className='rounded-2xl border border-border bg-surface px-4 py-4'>
      <div className='mb-2 flex items-center gap-2 text-sm text-text-secondary'>
        <span
          className={
            tone === 'warning' ? 'text-amber-600' : 'text-apple-green-600'
          }
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className='text-2xl font-medium text-text-primary'>{value}</div>
    </div>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

/* ---------- page ---------- */

export default function RegistrarDashboardPage() {
  // const {
  //   data: teachers,
  //   isLoading: teachersLoading,
  // } = useTeachers({ enabled: true });

  // const {
  //   data: assignments,
  //   isLoading: assignmentsLoading,
  // } = useAllAssignments({ enabled: true });

  // const {
  //   data: schedules,
  //   isLoading: schedulesLoading,
  // } = useAllSchedules({ enabled: true });

  // const loading = teachersLoading || assignmentsLoading || schedulesLoading;

  // if (loading) {
  //   return (
  //     <section className='w-full'>
  //       <p className='text-sm text-text-secondary'>Loading registrar data...</p>
  //     </section>
  //   );
  // }

  const teachers: TeacherListItem[] = registrarTeacherProfiles;
  const allAssignments: CourseAssignmentDetail[] = registrarCourseAssignments;
  const allSchedules: Schedule[] = registrarSchedules;

  const assignmentCount = allAssignments.length;
  const unscheduledCount = allAssignments.filter(
    (a: CourseAssignmentDetail) =>
      !allSchedules.some((s: Schedule) => s.assignment === a.id)
  ).length;

  const handleExportCsv = () => {
    const rows: string[][] = [
      [
        'Teacher',
        'Email',
        'Course',
        'Title',
        'Section',
        'Meeting',
        'Status',
        'Day',
        'Time',
        'Room',
      ],
    ];

    teachers.forEach((teacher: TeacherListItem) => {
      const teacherAssignments = allAssignments.filter(
        (a: CourseAssignmentDetail) => a.prof === teacher.id
      );
      teacherAssignments.forEach((assignment: CourseAssignmentDetail) => {
        const schedule = allSchedules.find(
          (s: Schedule) => s.assignment === assignment.id
        );
        const startTime = schedule?.start_time ?? '';
        rows.push([
          teacher.full_name,
          teacher.username,
          assignment.subject_label,
          assignment.subject_label,
          assignment.section_name,
          schedule ? schedule.mode_display ?? '' : '—',
          schedule ? 'Scheduled' : 'Pending',
          schedule ? schedule.day_display : '',
          startTime,
          schedule ? (schedule.room_name ?? '') : '',
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'teacher-assignments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <section className='w-full'>
      {/* Header */}
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-text-secondary'>
          1st semester, 2026 to 2027
        </p>

        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={handleExportPdf}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            <FileText size={14} />
            Export PDF
          </button>

          <button
            type='button'
            onClick={handleExportCsv}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            <FileSpreadsheet size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
        <StatTile
          icon={<Users size={16} />}
          label='Teachers'
          value={teachers.length}
        />
        <StatTile
          icon={<BookOpen size={16} />}
          label='Assignments'
          value={assignmentCount}
        />
        <StatTile
          icon={<Clock size={16} />}
          label='Unscheduled meetings'
          value={unscheduledCount}
          tone='warning'
        />
        <StatTile
          icon={<Activity size={16} />}
          label='Schedules Created'
          value={allSchedules.length}
        />
      </div>

      {/* Teachers as cards */}
      <div className='mt-6'>
        <h2 className='mb-3 text-sm font-medium text-text-primary'>
          Teachers and assignments
        </h2>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {teachers.map((teacher: TeacherListItem) => {
            const teacherAssignments = allAssignments.filter(
              (a: CourseAssignmentDetail) => a.prof === teacher.id
            );
            const teacherUnscheduled = teacherAssignments.filter(
              (a: CourseAssignmentDetail) =>
                !allSchedules.some((s: Schedule) => s.assignment === a.id)
            ).length;

            return (
              <div
                key={teacher.id}
                className='flex max-h-80 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface'
              >
                {/* Teacher header */}
                <Link
                  to={`/registrar/teacher/${teacher.id}`}
                  className='flex shrink-0 cursor-pointer items-center justify-between gap-3 border-b border-border px-4 py-3 transition hover:bg-surface-secondary'
                >
                  <div className='flex min-w-0 items-center gap-3'>
                    <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-medium text-apple-green-700'>
                      {initialsOf(teacher.full_name)}
                    </span>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-text-primary'>
                        {teacher.full_name}
                      </p>
                      <p className='text-xs text-text-tertiary'>
                        {teacherAssignments.length}{' '}
                        {teacherAssignments.length === 1
                          ? 'assignment'
                          : 'assignments'}
                      </p>
                    </div>
                  </div>

                  {teacherUnscheduled > 0 ? (
                    <span className='shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700'>
                      {teacherUnscheduled} pending
                    </span>
                  ) : (
                    <span className='shrink-0 rounded-full bg-apple-green-50 px-2.5 py-1 text-[10px] font-medium text-apple-green-700'>
                      All scheduled
                    </span>
                  )}
                </Link>

                {/* Assignments */}
                <div className='flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-border overflow-y-auto'>
                  {teacherAssignments.map(
                    (assignment: CourseAssignmentDetail) => {
                      const schedule = allSchedules.find(
                        (s: Schedule) => s.assignment === assignment.id
                      );
                      const isScheduled = Boolean(schedule);

                      return (
                        <div
                          key={assignment.id}
                          className='flex min-w-0 flex-col gap-1 px-4 py-3'
                        >
                          <div className='flex min-w-0 items-baseline justify-between gap-2'>
                            <span className='min-w-0 truncate text-sm font-medium text-text-primary'>
                              {assignment.subject_label}
                            </span>
                            <span className='shrink-0 text-xs text-text-tertiary'>
                              section {assignment.section_name}
                            </span>
                          </div>

                          <span
                            className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${
                              isScheduled
                                ? 'bg-apple-green-50 text-apple-green-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {assignment.meetings?.[0]?.mode_display}{' '}
                            {isScheduled ? 'scheduled' : 'pending'}
                          </span>

                          {isScheduled && schedule ? (
                            <span className='min-w-0 break-words text-xs text-text-secondary'>
                              {schedule.day_display}, {schedule.start_time || ''} ·{' '}
                              {schedule.room_name}
                            </span>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
