// pages/registrar/RegistrarDashboardPage.tsx
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Clock,
  Download,
  Users,
  X,
} from 'lucide-react';
import { useTeachers, useAllAssignments, useAllSchedules, useTerms } from '../../hooks/Schedule.hooks';
import { useExportSchedule } from '../../hooks/Schedule.hooks';
import { useToast } from '../../hooks/useToast';
import { StatTile } from '../../components/shared/StatTile';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ModeBadge } from '../../components/shared/ModeBadge';
import { SlideOverDrawer } from '../../components/shared/SlideOverDrawer';
import type {
  CourseAssignmentDetail,
  Schedule,
  TeacherListItem,
} from '../../types/Types';

/* ---------- small local pieces ---------- */

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

/* ---------- single teacher card (2-col grid, compact rows) ---------- */

const VISIBLE_ROW_LIMIT = 4;

function TeacherCard({
  teacher,
  allAssignments,
  allSchedules,
  onOpenDrawer,
}: {
  teacher: TeacherListItem;
  allAssignments: CourseAssignmentDetail[];
  allSchedules: Schedule[];
  onOpenDrawer: (teacherId: number) => void;
}) {
  const teacherAssignments = allAssignments.filter(
    (a: CourseAssignmentDetail) => a.prof === teacher.id
  );
  const teacherUnscheduled = teacherAssignments.filter(
    (a: CourseAssignmentDetail) =>
      !allSchedules.some((s: Schedule) => s.assignment === a.id)
  ).length;

  const hasMore = teacherAssignments.length > VISIBLE_ROW_LIMIT;
  const visibleAssignments = teacherAssignments.slice(0, VISIBLE_ROW_LIMIT);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDrawer(teacher.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className='flex min-w-0 flex-col rounded-2xl border border-border bg-surface cursor-pointer transition hover:border-apple-green-200 hover:shadow-sm'
    >
      {/* Teacher header */}
      <div className='flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3'>
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
      </div>

      {/* Assignments (max 4 visible) */}
      <div className='flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-border'>
        {visibleAssignments.map((assignment: CourseAssignmentDetail) => {
          const schedule = allSchedules.find(
            (s: Schedule) => s.assignment === assignment.id
          );
          const isScheduled = Boolean(schedule);

          return (
            <div
              key={assignment.id}
              className='shrink-0 flex items-center gap-4 px-4 py-2.5'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-medium text-text-primary'>
                  {assignment.subject_label}
                </span>
                <span className='text-xs text-text-tertiary truncate'>
                  section {assignment.section_name}
                </span>
              </div>

              <div className='flex items-center gap-2 shrink-0'>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    assignment.meetings?.[0]?.mode_display === 'Synchronous'
                      ? 'bg-apple-green-50 text-apple-green-700'
                      : assignment.meetings?.[0]?.mode_display === 'Laboratory'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-surface-secondary text-text-tertiary'
                  }`}
                >
                  {assignment.meetings?.[0]?.mode_display}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    isScheduled
                      ? 'bg-apple-green-50 text-apple-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {isScheduled ? 'Scheduled' : 'Pending'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer trigger */}
      {hasMore && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrawer(teacher.id);
          }}
          className='shrink-0 flex items-center justify-between px-4 py-3 text-xs font-medium text-apple-green-600 hover:bg-surface-secondary cursor-pointer transition border-t border-border-light'
        >
          <span>View all {teacherAssignments.length} assignments</span>
          <ArrowRight size={12} />
        </div>
      )}
    </div>
  );
}

/* ---------- slide-over drawer panel ---------- */

function TeacherAssignmentDrawer({
  teacher,
  assignments,
  schedules,
  onClose,
}: {
  teacher: TeacherListItem;
  assignments: CourseAssignmentDetail[];
  schedules: Schedule[];
  onClose: () => void;
}) {
  const teacherAssignments = assignments.filter(
    (a: CourseAssignmentDetail) => a.prof === teacher.id
  );

  return (
    <SlideOverDrawer isOpen={true} onClose={onClose}>
      {/* Drawer header */}
        <div className='flex items-center justify-between border-b border-border px-6 py-4 shrink-0'>
          <div className='flex items-center gap-3'>
            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[14px] font-medium text-apple-green-700'>
              {initialsOf(teacher.full_name)}
            </span>
            <div className='min-w-0'>
              <h2 className='text-sm font-semibold text-text-primary leading-none'>
                {teacher.full_name}
              </h2>
              <p className='text-xs text-text-tertiary leading-none'>
                {teacher.department_name || 'No department'}{' '}
                <span className='text-text-secondary'>
                  ·
                </span>{' '}
                {teacher.username}
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition'
          >
            <X size={16} />
          </button>
        </div>

        {/* Assignment count summary */}
        <div className='border-b border-border-light bg-surface-secondary px-6 py-3 shrink-0'>
          <div className='flex items-center justify-between text-xs text-text-secondary'>
            <span>
              {teacherAssignments.length} assignment{teacherAssignments.length === 1 ? '' : 's'}
            </span>
            <span>
              {teacherAssignments.filter(
                (a) => !schedules.some((s) => s.assignment === a.id)
              ).length} pending
            </span>
          </div>
        </div>

        {/* Scrollable assignment list */}
        <div className='flex-1 overflow-y-auto p-6'>
          {teacherAssignments.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-text-tertiary'>
              <p className='text-sm'>No assignments yet.</p>
            </div>
          ) : (
            <div className='divide-y divide-border-light'>
              {teacherAssignments.map((assignment: CourseAssignmentDetail) => {
                const schedule = schedules.find(
                  (s: Schedule) => s.assignment === assignment.id
                );
                const isScheduled = Boolean(schedule);

                return (
                  <div key={assignment.id} className='px-4 py-4'>
                    <div className='flex items-start gap-4'>
                      <div className='min-w-0 flex-1'>
                        <span className='block text-sm font-medium text-text-primary truncate'>
                          {assignment.subject_label}
                        </span>
                        <span className='text-xs text-text-tertiary truncate'>
                          Section {assignment.section_name}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 shrink-0'>
                        <ModeBadge mode={assignment.meetings?.[0]?.mode_display} />
                        <StatusBadge status={isScheduled ? 'scheduled' : 'pending'} />
                      </div>
                    </div>

                    {isScheduled && schedule ? (
                      <div className='mt-2 flex items-center gap-2 text-xs text-text-secondary'>
                        <span>{schedule.day_display}</span>
                        <span>{schedule.start_time} – {schedule.end_time}</span>
                        <span>·</span>
                        <span>{schedule.room_name}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </SlideOverDrawer>
  );
}

/* ---------- page ---------- */

export default function RegistrarDashboardPage() {
  const {
    data: terms,
    isLoading: termsLoading,
  } = useTerms({ enabled: true });

  const activeTermId = terms?.find((t) => t.is_active)?.id ?? undefined;

  const {
    data: teachers,
    isLoading: teachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers({ termId: activeTermId, enabled: true });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAllAssignments({ termId: activeTermId, enabled: true });

  const {
    data: schedules,
    isLoading: schedulesLoading,
    error: schedulesError,
    refetch: refetchSchedules,
  } = useAllSchedules({ termId: activeTermId, enabled: true });

  const exportScheduleMutation = useExportSchedule();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawerTeacherId, setDrawerTeacherId] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPage, setCarouselPage] = useState(0);
  const toast = useToast();

  // Refetch on mount so the dashboard always shows fresh data after
  // schedules are cleared or modified from other pages (timetable, etc.).
  useEffect(() => {
    refetchTeachers();
    refetchAssignments();
    refetchSchedules();
  }, [refetchTeachers, refetchAssignments, refetchSchedules]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerTeacherId !== null) {
        setDrawerTeacherId(null);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [drawerTeacherId]);

  const cardsPerView = () => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 2 : 1);

  const scrollPrev = () => {
    const el = carouselRef.current;
    if (!el) return;
    const cpv = cardsPerView();
    const nextPage = Math.max(0, carouselPage - cpv);
    setCarouselPage(nextPage);
    el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
  };

  const scrollNext = () => {
    const el = carouselRef.current;
    if (!el) return;
    const cpv = cardsPerView();
    const maxPage = Math.max(0, teachersList.length - cpv);
    const nextPage = Math.min(maxPage, carouselPage + cpv);
    setCarouselPage(nextPage);
    el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
  };

  const loading = teachersLoading || assignmentsLoading || schedulesLoading || termsLoading;
  const error = teachersError || assignmentsError || schedulesError;

  if (error) {
    return (
      <section className='w-full p-6'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 mb-4'>
          <p className='text-sm font-medium text-red-700 mb-2'>
            Failed to load registrar data.
          </p>
          <p className='text-xs text-text-tertiary mb-3'>
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

  const cpv = cardsPerView();
  const maxPage = Math.max(0, teachersList.length - cpv);
  const prevDisabled = carouselPage === 0;
  const nextDisabled = carouselPage >= maxPage;
  const carouselStart = carouselPage + 1;
  const carouselEnd = Math.min(carouselPage + cpv, teachersList.length);

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
      toast.addToast({
        type: 'error',
        title: 'No schedule data available to export.',
      });
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
      toast.addToast({
        type: 'error',
        title: 'Failed to export Master Schedule.',
      });
    } finally {
      setExporting(false);
    }
  };

  const drawerTeacher = drawerTeacherId
    ? teachersList.find((t) => t.id === drawerTeacherId)
    : undefined;

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
                    Export Master Schedule
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
                  Choose a format to download the current Master Schedule.
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

      {/* Teachers as cards — horizontal carousel */}
      <div className='mt-6'>
        {/* Clean section header */}
        <h2 className='mb-3 text-sm font-medium text-text-primary'>
          Teachers and assignments
        </h2>

        <div
          ref={carouselRef}
          className='flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 py-2'
        >
          {teachersList.map((teacher: TeacherListItem) => (
            <div key={teacher.id} className='shrink-0 snap-start w-full lg:w-[calc(50%-10px)]'>
              <TeacherCard
                teacher={teacher}
                allAssignments={allAssignments}
                allSchedules={allSchedules}
                onOpenDrawer={setDrawerTeacherId}
              />
            </div>
          ))}
        </div>

        {/* Bottom carousel controls */}
        <div className='mt-4 flex items-center justify-center gap-3'>
          <button
            type='button'
            onClick={scrollPrev}
            disabled={prevDisabled}
            className={`shrink-0 h-8 w-8 rounded-lg border text-xs font-medium transition ${
              prevDisabled
                ? 'border-border text-text-tertiary bg-surface-secondary opacity-40 cursor-not-allowed'
                : 'border-border hover:bg-gray-100 hover:text-text-primary'
            }`}
          >
            ‹
          </button>
          <span className='text-xs text-text-secondary'>
            {carouselStart}–{carouselEnd} of {teachersList.length}
          </span>
          <button
            type='button'
            onClick={scrollNext}
            disabled={nextDisabled}
            className={`shrink-0 h-8 w-8 rounded-lg border text-xs font-medium transition ${
              nextDisabled
                ? 'border-border text-text-tertiary bg-surface-secondary opacity-40 cursor-not-allowed'
                : 'border-border hover:bg-gray-100 hover:text-text-primary'
            }`}
          >
            ›
          </button>
        </div>
      </div>

      {/* Slide-over drawer */}
      {drawerTeacher && drawerTeacherId !== null && (
        <TeacherAssignmentDrawer
          teacher={drawerTeacher}
          assignments={allAssignments}
          schedules={allSchedules}
          onClose={() => setDrawerTeacherId(null)}
        />
      )}
    </section>
  );
}
