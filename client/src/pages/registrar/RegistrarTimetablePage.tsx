// pages/registrar/RegistrarTimetablePage.tsx
// Standalone timetable view for the registrar: view, add, edit, delete, clear schedules.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Download, Edit, X, RefreshCw } from 'lucide-react';
import {
  useSchedules,
  useTeachers,
  useCourses,
  useSections,
  useRooms,
} from '../../hooks/Schedule.hooks';
import {
  useDeleteScheduledClass,
  useUpdateScheduledClass,
  useClearScheduledClasses,
  useExportSchedule,
} from '../../hooks/GenerateManagement.hooks';
import type { Schedule, TeacherListItem, Course, Section } from '../../types/Types';
import { DAY_LABELS } from '../../pages/registrar/registrarData';

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

const TIME_SLOTS = [
  { label: '07:00', hour: 7 },
  { label: '08:00', hour: 8 },
  { label: '09:00', hour: 9 },
  { label: '10:00', hour: 10 },
  { label: '11:00', hour: 11 },
  { label: '12:00', hour: 12 },
  { label: '13:00', hour: 13 },
  { label: '14:00', hour: 14 },
  { label: '15:00', hour: 15 },
  { label: '16:00', hour: 16 },
];

export default function RegistrarTimetablePage() {
  const navigate = useNavigate();
  const { data: schedules, isLoading } = useSchedules();
  const { data: teachersData } = useTeachers();
  const { data: coursesData } = useCourses();
  const { data: sectionsData } = useSections();
  const { data: roomsData } = useRooms();

  const updateScheduledClassMutation = useUpdateScheduledClass();
  const deleteScheduledClassMutation = useDeleteScheduledClass();
  const clearScheduledClassesMutation = useClearScheduledClasses();

  const teachers: TeacherListItem[] = teachersData ?? [];
  const courses: Course[] = coursesData ?? [];
  const sections: Section[] = sectionsData ?? [];
  const rooms = (roomsData ?? []) as { id: number; name: string }[];

  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editProfId, setEditProfId] = useState<number | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<number | null>(null);
  const [editSectionId, setEditSectionId] = useState<number | null>(null);
  const [editRoom, setEditRoom] = useState<number | null>(null);
  const [editDay, setEditDay] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editDurationSlots, setEditDurationSlots] = useState<number>(1);
  const [editMode, setEditMode] = useState<string>('sync');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const exportScheduleMutation = useExportSchedule();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runId = (schedules ?? [])[0]?.run ?? null;

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
      setGenerateError('Failed to export timetable.');
    } finally {
      setExporting(false);
    }
  };

  const totalClasses = (schedules ?? []).length;

  const MODE_OPTIONS = [
    { value: 'sync', label: 'Synchronous' },
    { value: 'async', label: 'Asynchronous' },
    { value: 'lab', label: 'Laboratory' },
  ];

  const DURATION_OPTIONS = [1, 2, 3];

  const handleOpenEdit = (cls: Schedule) => {
    setEditingClassId(cls.id);
    setEditProfId(cls.prof_id ?? null);
    setEditSubjectId(null); // resolved from assignment below if needed
    setEditSectionId(null);
    setEditRoom(cls.room ?? null);
    setEditDay(cls.day);
    setEditStartTime(cls.start_time);
    setEditDurationSlots(cls.duration_slots ?? 1);
    setEditMode(cls.mode ?? 'sync');
  };

  const handleSaveEdit = () => {
    if (!editingClassId) return;

    const current = (schedules ?? []).find((c) => c.id === editingClassId);
    if (!current) return;

    const updateData: {
      room?: number | null;
      day?: number;
      start_time?: string;
      duration_slots?: number;
      mode?: string | null;
      prof_id?: number;
      subject_id?: number;
      section_id?: number;
    } = {};

    if (editRoom !== null && editRoom !== current.room) {
      updateData.room = editRoom;
    }
    if (editDay !== null && editDay !== current.day) {
      updateData.day = editDay;
    }
    if (editStartTime && editStartTime !== current.start_time) {
      updateData.start_time = editStartTime;
    }
    if (editDurationSlots !== (current.duration_slots ?? 1)) {
      updateData.duration_slots = editDurationSlots;
    }
    if (editMode && editMode !== (current.mode ?? 'sync')) {
      updateData.mode = editMode;
    }
    if (editProfId !== null && editProfId !== current.prof_id) {
      updateData.prof_id = editProfId;
    }
    if (editSubjectId !== null) {
      updateData.subject_id = editSubjectId;
    }
    if (editSectionId !== null) {
      updateData.section_id = editSectionId;
    }

    if (Object.keys(updateData).length === 0) {
      setEditingClassId(null);
      setEditRoom(null);
      setEditDay(null);
      setEditStartTime('');
      return;
    }

    // We need the run_id; schedules don't include it directly, so use the first
    // schedule's run as the active run. If we need a specific run_id, it should
    // be passed from context. For now, we attempt update without run_id —
    // the backend URL needs run_id. We'll get it from the schedule's run field.
    const runId = current.run;

    updateScheduledClassMutation.mutate(
      {
        runId,
        classId: editingClassId,
        data: updateData,
      },
      {
        onSuccess: () => {
          setEditingClassId(null);
          setEditProfId(null);
          setEditSubjectId(null);
          setEditSectionId(null);
          setEditRoom(null);
          setEditDay(null);
          setEditStartTime('');
          setEditDurationSlots(1);
          setEditMode('sync');
        },
        onError: (err: Error) => {
          setGenerateError(err.message || 'Failed to update class');
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingClassId(null);
    setEditProfId(null);
    setEditSubjectId(null);
    setEditSectionId(null);
    setEditRoom(null);
    setEditDay(null);
    setEditStartTime('');
    setEditDurationSlots(1);
    setEditMode('sync');
  };

  const handleDeleteClass = (classId: number) => {
    const current = (schedules ?? []).find((c) => c.id === classId);
    if (!current) return;

    deleteScheduledClassMutation.mutate(
      { runId: current.run, classId },
      {
        onError: (err: Error) => {
          setGenerateError(err.message || 'Failed to delete class');
        },
      }
    );
  };

  const handleClearSchedule = () => {
    if (totalClasses === 0) return;
    if (!window.confirm('Are you sure you want to clear all scheduled classes?')) return;

    // Use the first schedule's run as the active run
    const runId = (schedules ?? [])[0]?.run;
    if (!runId) return;

    clearScheduledClassesMutation.mutate(runId, {
      onError: (err: Error) => {
        setGenerateError(err.message || 'Failed to clear schedules');
      },
    });
  };

  const filterTeacher = (search: string) => {
    const query = search.trim().toLowerCase();
    const list = schedules ?? [];
    if (!query) return [...list];
    return list.filter((cls) => {
      const cleaned = cleanTeacherName(cls.prof_name).toLowerCase();
      const raw = cls.prof_name.toLowerCase();
      return cleaned.includes(query) || raw.includes(query);
    });
  };


  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface-secondary'>
        <div className='text-text-secondary'>Loading timetable…</div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen bg-surface-secondary'>
      <div className='flex-1 px-6 py-8 sm:px-8 lg:px-12'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-lg font-semibold text-text-primary'>Timetable</h1>
            <p className='text-sm text-text-secondary mt-0.5'>
              {totalClasses} scheduled class{totalClasses !== 1 ? 's' : ''}
            </p>
          </div>
          <div className='flex gap-2'>
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
              the timetable.
            </p>
          </div>
        ) : (
          <>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <input
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Filter by professor…'
                className='h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
              />
              {search && (
                <span className='text-xs text-text-secondary'>
                  {filterTeacher(search).length} of {totalClasses} classes
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
                {filterTeacher(search).length === 0 ? (
                  <tr>
                    <td colSpan={10} className='px-3 py-8 text-center text-text-secondary'>
                      No classes match "{search}".
                    </td>
                  </tr>
                ) : (
                filterTeacher(search)
                  .sort((a, b) => {
                    const da = a.day ?? 0;
                    const db = b.day ?? 0;
                    if (da !== db) return da - db;
                    return a.start_time.localeCompare(b.start_time);
                  })
                  .map((cls) => (
                    <tr key={cls.id} className='border-b border-border-light hover:bg-surface-secondary'>
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
                        {cls.mode_display ?? cls.mode ?? ''}
                      </td>
                      <td className='px-3 py-1 text-[9px]'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(cls);
                          }}
                          className='w-full h-7 rounded bg-apple-green-600 text-[9px] font-medium text-white hover:bg-apple-green-700 transition flex items-center justify-center gap-1'
                          title='Edit'
                        >
                          <Edit size={10} className='mr-0.5' /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </>
        )}

        {/* Edit Class Modal */}
        {editingClassId !== null && (
          <div className='fixed inset-0 z-50 flex items-center justify-center'>
            <div
              className='absolute inset-0 bg-black/40 backdrop-blur-sm'
              onClick={handleCancelEdit}
            />
            <div className='relative bg-surface p-6 rounded-xl border border-border shadow-xl w-full max-w-md z-10'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-sm font-medium text-text-primary'>
                  Edit Class
                </h3>
                <button
                  type='button'
                  onClick={handleCancelEdit}
                  className='text-text-secondary hover:text-text-primary'
                >
                  <X size={16} />
                </button>
              </div>

              <div className='space-y-4'>
                {/* Professor */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Professor
                  </label>
                  <select
                    value={editProfId ?? ''}
                    onChange={(e) =>
                      setEditProfId(e.target.value ? Number(e.target.value) : null)
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select professor</option>
                    {teachers.map((t: TeacherListItem) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Subject
                  </label>
                  <select
                    value={editSubjectId ?? ''}
                    onChange={(e) =>
                      setEditSubjectId(e.target.value ? Number(e.target.value) : null)
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select subject</option>
                    {courses.map((c: Course) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Section
                  </label>
                  <select
                    value={editSectionId ?? ''}
                    onChange={(e) =>
                      setEditSectionId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select section</option>
                    {sections.map((s: Section) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Room
                  </label>
                  <select
                    value={editRoom ?? ''}
                    onChange={(e) =>
                      setEditRoom(e.target.value ? Number(e.target.value) : null)
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select room</option>
                    {rooms.map((room: { id: number; name: string }) => (
                      <option key={room.id} value={room.id}>
                        {room.name || `Room ${room.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Day
                  </label>
                  <select
                    value={editDay ?? ''}
                    onChange={(e) =>
                      setEditDay(e.target.value ? Number(e.target.value) : null)
                    }
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    {[0, 1, 2, 3, 4].map((d) => (
                      <option key={d} value={d}>
                        {DAY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Time */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Start Time
                  </label>
                  <select
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    <option value=''>Select time</option>
                    {TIME_SLOTS.map((s: { label: string; hour: number }) => (
                      <option key={s.label} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Duration (slots)
                  </label>
                  <select
                    value={editDurationSlots}
                    onChange={(e) => setEditDurationSlots(Number(e.target.value))}
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mode */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Mode
                  </label>
                  <select
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value)}
                    className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  >
                    {MODE_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* End Time (read-only) */}
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    End Time
                  </label>
                  <div className='h-9 rounded-lg border border-border bg-surface-tertiary px-2 text-xs text-text-secondary flex items-center'>
                    {editStartTime
                      ? (() => {
                          const [h, m] = editStartTime.split(':').map(Number);
                          const end = new Date(0, 0, 0, h + editDurationSlots, m);
                          const eh = String(end.getHours()).padStart(2, '0');
                          const em = String(end.getMinutes()).padStart(2, '0');
                          return `${eh}:${em}`;
                        })()
                      : '—'}
                  </div>
                </div>
              </div>

              <div className='mt-6 flex gap-3'>
                <button
                  type='button'
                  onClick={handleCancelEdit}
                  className='flex-1 h-9 rounded-lg border border-border bg-surface-tertiary px-3 text-xs font-medium text-text-secondary transition hover:bg-surface-secondary'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={() => {
                    handleDeleteClass(editingClassId!);
                    handleCancelEdit();
                  }}
                  className='flex-1 h-9 rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700'
                >
                  Delete
                </button>
                <button
                  type='button'
                  onClick={handleSaveEdit}
                  disabled={updateScheduledClassMutation.isPending}
                  className='flex-1 h-9 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
                >
                  {updateScheduledClassMutation.isPending
                    ? 'Saving…'
                    : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
