// pages/registrar/RegistrarTimetablePage.tsx
// Standalone master schedule view for the registrar: view, add, edit, delete, clear schedules.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Download,
  Edit,
  ListChecks,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  useAllAssignments,
  useClearScheduledClasses,
  useCourses,
  useExportSchedule,
  useGetConflicts,
  useIgnoreConflict,
  useResolveConflict,
  useRooms,
  useSchedules,
  useSections,
  useTeachers,
  useTerms,
} from '../../hooks/Schedule.hooks';
import { ClassScheduleModal } from '../../components/shared/ClassScheduleModal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { SlideOverDrawer } from '../../components/shared/SlideOverDrawer';
import { useToast } from '../../hooks/useToast';
import type {
  Course,
  CourseAssignmentDetail,
  Room,
  Schedule,
  Section,
  TeacherListItem,
} from '../../types/Types';
import { DAY_LABELS } from '../../types/Types';

const cleanTeacherName = (name: string) => {
  return name.replace(/^demo_/, '');
};

const splitSubject = (label: string) => {
  const parts = label.split(' - ');
  return {
    code: parts[0] ?? '',
    title: parts.slice(1).join(' - '),
  };
};

export default function RegistrarTimetablePage() {
  const navigate = useNavigate();
  const { data: schedules, isLoading } = useSchedules();
  const { data: teachersData } = useTeachers();
  const { data: coursesData } = useCourses();
  const { data: sectionsData } = useSections();
  const { data: roomsData } = useRooms();

  const { data: termsData } = useTerms();
  const { data: assignmentsData } = useAllAssignments({
    termId: termsData?.find((t) => t.is_active)?.id,
  });

  const clearScheduledClassesMutation = useClearScheduledClasses();

  const teachers: TeacherListItem[] = teachersData ?? [];
  const courses: Course[] = coursesData ?? [];
  const sections: Section[] = sectionsData ?? [];
  const rooms: Room[] = roomsData ?? [];

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [schedulingAssignment, setSchedulingAssignment] =
    useState<CourseAssignmentDetail | null>(null);
  const [sectionFilter, setSectionFilter] = useState<number | 'all'>('all');
  const [roomFilter, setRoomFilter] = useState<number | 'all'>('all');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const exportScheduleMutation = useExportSchedule();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<number | null>(null);

  const getConflicts = useGetConflicts();

  const [conflicts, setConflicts] = useState<{
    room_conflicts: Array<{ id: number; classes: Array<{ id: number }> }>;
    professor_conflicts: Array<{ id: number; classes: Array<{ id: number }> }>;
    section_conflicts: Array<{ id: number; classes: Array<{ id: number }> }>;
    capacity_violations: Array<{ class_id: number }>;
    availability_violations: Array<{ class_id: number }>;
    consecutive_violations: Array<{ classes: Array<{ id: number }> }>;
    daily_hours_violations: Array<{ classes: Array<{ id: number }> }>;
  }>({ room_conflicts: [], professor_conflicts: [], section_conflicts: [], capacity_violations: [], availability_violations: [], consecutive_violations: [], daily_hours_violations: [] });
  const runId = (schedules ?? [])[0]?.run ?? null;

  useEffect(() => {
    if (runId) {
      getConflicts.mutate(runId, {
        onSuccess: (data) => setConflicts(data),
        onError: () => setConflicts({
          room_conflicts: [], professor_conflicts: [], section_conflicts: [],
          capacity_violations: [], availability_violations: [], consecutive_violations: [], daily_hours_violations: [],
        }),
      });
    }
  }, [runId, getConflicts]);

  const handleExport = async (format: string) => {
    if (!runId) {
      setGenerateError('No schedule data available to export.');
      return;
    }
    setExportPanelOpen(false);
    setExporting(true);
    try {
      const blob = await exportScheduleMutation.mutateAsync({
        runId,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetable.${format === 'xlsx' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setGenerateError('Failed to export Master Schedule.');
    } finally {
      setExporting(false);
    }
  };

  const totalClasses = (schedules ?? []).length;

  const activeTerm = termsData?.find((term) => term.is_active) ?? null;
  const scheduledAssignmentIds = new Set(
    (schedules ?? []).map((cls) => cls.assignment)
  );
  const unscheduledAssignments = (assignmentsData ?? []).filter(
    (assignment) =>
      (!activeTerm || assignment.term === activeTerm.id) &&
      !scheduledAssignmentIds.has(assignment.id)
  );

  const filteredClasses = (() => {
    const query = search.trim().toLowerCase();
    return (schedules ?? []).filter((cls) => {
      if (sectionFilter !== 'all' && cls.section_id !== sectionFilter) {
        return false;
      }
      if (roomFilter !== 'all' && cls.room !== roomFilter) {
        return false;
      }
      if (!query) return true;
      const cleaned = cleanTeacherName(cls.prof_name).toLowerCase();
      const raw = cls.prof_name.toLowerCase();
      return cleaned.includes(query) || raw.includes(query);
    });
  })();

  const handleClearSchedule = () => {
    if (totalClasses === 0) return;
    setConfirmClear(true);
  };

  const handleConfirmClear = () => {
    const runId = (schedules ?? [])[0]?.run;
    if (!runId) {
      setConfirmClear(false);
      return;
    }
    clearScheduledClassesMutation.mutate(runId, {
      onError: (err: Error) => {
        setGenerateError(err.message || 'Failed to clear schedules');
      },
    });
    setConfirmClear(false);
  };

  const conflictClassIds = new Set<number>();
  conflicts.room_conflicts.forEach((c) =>
    c.classes.forEach((cls) => conflictClassIds.add(cls.id))
  );
  conflicts.professor_conflicts.forEach((c) =>
    c.classes.forEach((cls) => conflictClassIds.add(cls.id))
  );
  conflicts.section_conflicts.forEach((c) =>
    c.classes.forEach((cls) => conflictClassIds.add(cls.id))
  );
  conflicts.capacity_violations.forEach((c) => conflictClassIds.add(c.class_id));
  conflicts.availability_violations.forEach((c) =>
    conflictClassIds.add(c.class_id)
  );
  conflicts.consecutive_violations.forEach((c) =>
    c.classes.forEach((cls) => conflictClassIds.add(cls.id))
  );
  conflicts.daily_hours_violations.forEach((c) =>
    c.classes.forEach((cls) => conflictClassIds.add(cls.id))
  );

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface-secondary'>
        <div className='text-text-secondary'>Loading master schedule…</div>
      </div>
    );
  }

  return (
    <>
      <div className='flex min-h-screen bg-surface-secondary'>
      <div className='flex-1 px-6 py-8 sm:px-8 lg:px-12'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-lg font-semibold text-text-primary'>Master Schedule</h1>
            <p className='text-sm text-text-secondary mt-0.5'>
              {totalClasses} scheduled class{totalClasses !== 1 ? 'es' : ''}
            </p>
          </div>
          <div className='flex flex-wrap justify-end gap-2'>
            <button
              type='button'
              onClick={() => setQueueOpen(true)}
              className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-text-primary transition hover:bg-surface-secondary'
            >
              <ListChecks size={14} /> Unscheduled ({unscheduledAssignments.length})
            </button>
            <button
              type='button'
              onClick={handleClearSchedule}
              disabled={totalClasses === 0}
              className='flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              Clear All Schedules
            </button>
            <button
              type='button'
              onClick={() => setExportPanelOpen(true)}
              disabled={totalClasses === 0}
              className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
            >
              <Download size={14} /> Export
            </button>
            <button
              type='button'
              onClick={() => navigate('/registrar/schedule-management')}
              className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-text-primary transition hover:bg-surface-secondary'
            >
              <RefreshCw size={14} /> Back to Generate
            </button>
          </div>
        </div>

        {generateError && (
          <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-3'>
            <p className='text-sm text-red-700'>{generateError}</p>
          </div>
        )}

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

        {totalClasses === 0 ? (
          <div className='rounded-card border border-border bg-surface p-6 text-center py-16'>
            <div className='flex h-16 w-16 items-center justify-center rounded-full bg-apple-green-50 text-apple-green-600 mx-auto mb-4'>
              <Calendar size={24} />
            </div>
            <h2 className='text-sm font-semibold text-text-primary mb-1'>
              No scheduled classes yet.
            </h2>
            <p className='text-xs text-text-secondary'>
              Generate a schedule on the Schedule Management page to populate
              the Master Schedule.
            </p>
          </div>
        ) : (
          <>
            <div className='mb-3 flex flex-wrap items-center gap-2'>
              <input
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Filter by professor…'
                className='h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
              />
              <select
                value={sectionFilter}
                onChange={(e) =>
                  setSectionFilter(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                aria-label='Filter by section'
                className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none transition focus:border-apple-green-400'
              >
                <option value='all'>All sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <select
                value={roomFilter}
                onChange={(e) =>
                  setRoomFilter(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                aria-label='Filter by room'
                className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none transition focus:border-apple-green-400'
              >
                <option value='all'>All rooms</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name || `Room ${room.id}`}
                  </option>
                ))}
              </select>
              {(search || sectionFilter !== 'all' || roomFilter !== 'all') && (
                <span className='text-xs text-text-secondary'>
                  {filteredClasses.length} of {totalClasses} classes
                </span>
              )}
            </div>
            <div className='max-h-[65vh] overflow-auto border border-border rounded-lg'>
            <table className='min-w-full text-xs border-collapse'>
              <thead>
                <tr className='border-b border-border text-left text-[10px] text-text-secondary'>
                  <th className='px-3 py-2'>Day</th>
                  <th className='px-3 py-2'>Start</th>
                  <th className='px-3 py-2'>End</th>
                  <th className='px-3 py-2'>Subject Code</th>
                  <th className='px-3 py-2'>Title</th>
                  <th className='px-3 py-2'>Section</th>
                  <th className='px-3 py-2'>Professor</th>
                  <th className='px-3 py-2'>Room</th>
                  <th className='px-3 py-2'>Mode</th>
                  <th className='px-3 py-2'>Actions</th>
                </tr>
              </thead>
              <tbody>
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className='px-3 py-8 text-center text-text-secondary'>
                        No classes match the current filters.
                      </td>
                    </tr>
                  ) : (
                  filteredClasses
                    .sort((a, b) => {
                      const da = a.day ?? 0;
                      const db = b.day ?? 0;
                      if (da !== db) return da - db;
                      return a.start_time.localeCompare(b.start_time);
                    })
                    .map((cls) => {
                      const hasConflict = conflictClassIds.has(cls.id);
                      const clsConflicts = [
                        ...conflicts.room_conflicts,
                        ...conflicts.professor_conflicts,
                        ...conflicts.section_conflicts,
                      ].filter((c) =>
                        c.classes.some((c2) => c2.id === cls.id)
                      );
                      return (
                        <tr key={cls.id} className={`border-b border-border-light ${hasConflict ? 'bg-red-50' : 'hover:bg-surface-secondary'}`}>
                          <td className='px-3 py-1 text-[9px] text-text-secondary'>
                            {DAY_LABELS[cls.day ?? 0]}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary'>
                            {cls.start_time.replace(/:00$/, '')}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary'>
                            {cls.end_time ? cls.end_time.replace(/:00$/, '') : ''}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-primary truncate max-w-[90px]'>
                            {splitSubject(cls.subject_label).code}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary truncate max-w-[150px]'>
                            {splitSubject(cls.subject_label).title}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary truncate max-w-[100px]'>
                            {cls.section_name}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary truncate max-w-[110px]'>
                            {cleanTeacherName(cls.prof_name)}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary truncate max-w-[90px]'>
                            {cls.room_name ?? cls.room}
                          </td>
                          <td className='px-3 py-1 text-[9px] text-text-secondary'>
                            <div className='flex items-center gap-1'>
                              {cls.mode_display ?? cls.mode ?? ''}
                              {clsConflicts.length > 0 && (
                                <span className='ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium text-red-700 bg-red-50'>
                                  ⚠ {clsConflicts.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className='px-3 py-1 text-[9px] text-center'>
                            <div className='flex items-center gap-1'>
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSchedule(cls);
                                }}
                                className='w-full h-7 rounded bg-apple-green-600 text-[9px] font-medium text-white hover:bg-apple-green-700 transition flex items-center justify-center gap-1'
                                title='Edit'
                              >
                                <Edit size={10} className='mr-0.5' /> Edit
                              </button>
                              {clsConflicts.length > 0 && (
                                <button
                                  type='button'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedConflict(cls.id);
                                  }}
                                  className='w-full h-7 rounded bg-red-600 text-[9px] font-medium text-white hover:bg-red-700 transition flex items-center justify-center gap-1'
                                  title='Resolve Conflict'
                                >
                                  <AlertTriangle size={10} className='mr-0.5' /> Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
            </div>
          </>
        )}

        {schedulingAssignment && runId && (
          <ClassScheduleModal
            mode='create'
            runId={runId}
            assignment={schedulingAssignment}
            professors={teachers}
            courses={courses}
            sections={sections}
            rooms={rooms}
            onClose={() => setSchedulingAssignment(null)}
            onSaved={() => {
              if (runId) getConflicts.mutate(runId);
            }}
          />
        )}

        {editingSchedule && (
          <ClassScheduleModal
            mode='edit'
            runId={editingSchedule.run}
            schedule={editingSchedule}
            professors={teachers}
            courses={courses}
            sections={sections}
            rooms={rooms}
            onClose={() => setEditingSchedule(null)}
            onSaved={() => {
              if (runId) getConflicts.mutate(runId);
            }}
            onDeleted={() => {
              if (runId) getConflicts.mutate(runId);
            }}
          />
        )}
      </div>
    </div>

    <SlideOverDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)}>
      <div className='flex shrink-0 items-center justify-between border-b border-border px-6 py-4'>
        <div>
          <h2 className='text-sm font-medium text-text-primary'>
            Unscheduled Assignments
          </h2>
          <p className='text-xs text-text-tertiary'>
            {unscheduledAssignments.length} awaiting scheduling
            {activeTerm ? ` · ${activeTerm.name}` : ''}
          </p>
        </div>
        <button
          type='button'
          onClick={() => setQueueOpen(false)}
          className='shrink-0 rounded-full p-1.5 text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
        >
          <X size={16} />
        </button>
      </div>

      <div className='flex-1 overflow-y-auto p-6'>
        {unscheduledAssignments.length === 0 ? (
          <p className='text-sm text-text-secondary'>
            Everything in the active term is scheduled.
          </p>
        ) : (
          <div className='space-y-3'>
            {unscheduledAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className='rounded-lg border border-border p-3'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-text-primary'>
                      {assignment.subject_label}
                    </p>
                    <p className='truncate text-xs text-text-secondary'>
                      {cleanTeacherName(assignment.prof_name)} ·{' '}
                      {assignment.section_name}
                    </p>
                    <p className='mt-1 text-[10px] text-text-tertiary'>
                      {assignment.meetings?.[0]?.mode_display ?? 'No meeting'} ·{' '}
                      {assignment.meetings?.[0]?.duration_slots ?? 1} slot(s)
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      setQueueOpen(false);
                      setSchedulingAssignment(assignment);
                    }}
                    disabled={!runId}
                    title={
                      runId ? 'Schedule class' : 'Generate a schedule first'
                    }
                    className='h-8 shrink-0 rounded-md bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideOverDrawer>

    <ConfirmDialog
      isOpen={confirmClear}
      title='Clear All Schedules'
      message='Are you sure you want to clear all scheduled classes? This cannot be undone.'
      confirmText='Clear All'
      cancelText='Cancel'
      onConfirm={handleConfirmClear}
      onCancel={() => setConfirmClear(false)}
    />
    {selectedConflict && (
      <ConflictResolutionDialog
        conflictId={selectedConflict}
        onClose={() => setSelectedConflict(null)}
        onResolved={() => {
          setSelectedConflict(null);
          if (runId) getConflicts.mutate(runId);
        }}
      />
    )}
  </>
  );
}

function ConflictResolutionDialog({
  conflictId,
  onClose,
  onResolved,
}: {
  conflictId: number;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [resolutionType, setResolutionType] = useState<string>('');
  const resolveConflict = useResolveConflict();
  const ignoreConflict = useIgnoreConflict();
  const toast = useToast();

  const handleResolve = () => {
    resolveConflict.mutate(
      {
        conflictId,
        resolutionType,
        resolutionDetails: {},
      },
      {
        onSuccess: () => {
          toast.addToast({ type: 'success', title: 'Conflict resolved.' });
          onClose();
          onResolved();
        },
        onError: () =>
          toast.addToast({ type: 'error', title: 'Failed to resolve conflict.' }),
      },
    );
  };

  const handleIgnore = () => {
    ignoreConflict.mutate(conflictId, {
      onSuccess: () => {
        toast.addToast({ type: 'success', title: 'Conflict ignored.' });
        onClose();
      },
      onError: () =>
        toast.addToast({ type: 'error', title: 'Failed to ignore conflict.' }),
    });
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div className='fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center justify-between border-b border-border px-6 py-4 shrink-0'>
          <h2 className='text-sm font-medium text-text-primary'>Resolve Conflict</h2>
          <button type='button' onClick={onClose} className='shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition'>
            <X size={16} />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          <div className='flex items-center justify-between mb-4'>
            <span className='text-sm font-medium text-text-tertiary'>Conflict ID:</span>
            <span className='text-sm font-medium text-text-primary'>#{conflictId}</span>
          </div>
          <div className='mb-4'>
            <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2'>Resolution Type</label>
            <div className='space-y-2'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='resolutionType'
                  value='swap_times'
                  checked={resolutionType === 'swap_times'}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className='rounded border-red-600 text-red-600 focus:ring-red-600'
                />
                <span className='text-sm text-text-primary'>Swap Times</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='resolutionType'
                  value='swap_rooms'
                  checked={resolutionType === 'swap_rooms'}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className='rounded border-red-600 text-red-600 focus:ring-red-600'
                />
                <span className='text-sm text-text-primary'>Swap Rooms</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='resolutionType'
                  value='change_professor'
                  checked={resolutionType === 'change_professor'}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className='rounded border-red-600 text-red-600 focus:ring-red-600'
                />
                <span className='text-sm text-text-primary'>Change Professor</span>
              </label>
            </div>
          </div>
          <div className='mt-6 flex justify-end gap-3'>
            <button type='button' onClick={onClose} className='flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'>
              Cancel
            </button>
            <button type='button' onClick={handleResolve} disabled={!resolutionType} className='flex h-8 items-center justify-center gap-2 rounded-md bg-apple-green-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:opacity-60 disabled:cursor-not-allowed'>
              Resolve
            </button>
            <button type='button' onClick={handleIgnore} className='flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'>
              Ignore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
