// pages/registrar/RegistrarDashboardPage.tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  Clock,
  Download,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeachers, useAllAssignments, useAllSchedules } from '../../hooks/Registrar.hooks';
import { useExportSchedule } from '../../hooks/GenerateManagement.hooks';
import type {
  CourseAssignmentDetail,
  Schedule,
  TeacherListItem,
} from '../../types/Types';

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
  const {
    data: teachers,
    isLoading: teachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers({ enabled: true });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAllAssignments({ enabled: true });

  const {
    data: schedules,
    isLoading: schedulesLoading,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useAllSchedules({ enabled: true });

  const exportScheduleMutation = useExportSchedule();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loading = teachersLoading || assignmentsLoading || schedulesLoading;
  const error = teachersError || assignmentsError || schedulesError;

  if (error) {
    return (
      <section className='w-full p-6'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 mb-4'>
          <p className='text-sm font-medium text-red-700 mb-2'>
            Failed to load registrar data.
          </p>
          <p className='text-xs text-red-600 mb-3'>
            {error.message ?? 'Unable to load data from the API.'}
          </p>
          <button
            type='button'
            onClick={() => {
              refetchTeachers();
              refetchAssignments();
              refetchSchedules();
            }}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary transition hover:bg-surface-secondary'
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className='w-full'>
        <p className='text-sm text-text-secondary'>Loading registrar data...</p>
      </section>
    );
  }

  const teachersList: TeacherListItem[] = teachers ?? [];
  const allAssignments: CourseAssignmentDetail[] = assignments ?? [];
  const allSchedules: Schedule[] = schedules ?? [];

  const assignmentCount = allAssignments.length;

  // Build a Set of scheduled assignment ids for O(1) lookups.
  const scheduledAssignmentIds = new Set(
    allSchedules.map((s: Schedule) => s.assignment)
  );
  const unscheduledCount = allAssignments.filter(
    (a: CourseAssignmentDetail) => !scheduledAssignmentIds.has(a.id)
  ).length;

  const runId = allSchedules.length > 0 ? allSchedules[0].run : null;

  const handleExport = async (format: string) => {
    if (!runId) {
      alert('No schedule data available to export.');
      return;
    }
    setExportPanelOpen(false);
    setExporting(true);
    try {
      const blob = await exportScheduleMutation.mutateAsync({ runId, format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetable.${format === 'xlsx' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export timetable.');
    } finally {
      setExporting(false);
    }
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
            onClick={() => setExportPanelOpen(true)}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            <Download size={14} />
            Export
          </button>

          {/* Export format panel */}
          {exportPanelOpen && (
            <div className='fixed inset-0 z-50 flex items-center justify-center'>
              <div
                className='absolute inset-0 bg-black/40 backdrop-blur-sm'
                onClick={() => setExportPanelOpen(false)}
              />
              <div className='relative bg-surface p-6 rounded-xl border border-border shadow-xl w-full max-w-xs z-10'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-sm font-medium text-text-primary'>
                    Export Timetable
                  </h3>
                  <button
                    type='button'
                    onClick={() => setExportPanelOpen(false)}
                    className='text-text-secondary hover:text-text-primary'
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className='text-xs text-text-secondary mb-6'>
                  Choose a format to download the current timetable.
                </p>
                <div className='grid grid-cols-1 gap-2'>
                  <button
                    type='button'
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
                  >
                    {exporting ? 'Exporting…' : 'CSV'}
                  </button>
                  <button
                    type='button'
                    onClick={() => handleExport('xlsx')}
                    disabled={exporting}
                    className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
                  >
                    {exporting ? 'Exporting…' : 'Excel (XLSX)'}
                  </button>
                  <button
                    type='button'
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
                  >
                    {exporting ? 'Exporting…' : 'PDF'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
        <StatTile
          icon={<Users size={16} />}
          label='Teachers'
          value={teachersList.length}
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
          {teachersList.map((teacher: TeacherListItem) => {
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
                  to={`/registrar/teachers/${teacher.id}`}
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
