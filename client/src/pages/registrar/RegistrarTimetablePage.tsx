// pages/registrar/RegistrarTimetablePage.tsx
// Standalone timetable view for the registrar: view, add, edit, delete, clear schedules.
import { useId, useState } from 'react';
import {
  CalendarDays,
  Download,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  LinkButton,
  LoadingState,
  Modal,
  PageHeader,
  SegmentedControl,
  SelectField,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TextField,
  type SegmentedOption,
} from '../../components/ui';
import type {
  Schedule,
  TeacherListItem,
  Course,
  Section,
} from '../../types/Types';
import { DAY_LABELS } from '../../types/Types';

const cleanTeacherName = (name: string) => name.replace(/^demo_/, '');

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

const MODE_OPTIONS = [
  { value: 'sync', label: 'Synchronous' },
  { value: 'async', label: 'Asynchronous' },
  { value: 'lab', label: 'Laboratory' },
];

const DURATION_OPTIONS = [1, 2, 3];

type DayFilter = 'all' | '0' | '1' | '2' | '3' | '4';

const formatTime = (value: string | null) =>
  value ? value.replace(/:00$/, '').slice(0, 5) : '—';

function calculateEndTime(startTime: string, durationSlots: number) {
  if (!startTime) return '—';
  const [hours, minutes] = startTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '—';
  const end = new Date(0, 0, 0, hours + durationSlots, minutes);
  return `${String(end.getHours()).padStart(2, '0')}:${String(
    end.getMinutes()
  ).padStart(2, '0')}`;
}

export default function RegistrarTimetablePage() {
  const editFormId = useId();

  const { data: schedules, isLoading } = useSchedules();
  const { data: teachersData } = useTeachers();
  const { data: coursesData } = useCourses();
  const { data: sectionsData } = useSections();
  const { data: roomsData } = useRooms();

  const updateScheduledClassMutation = useUpdateScheduledClass();
  const deleteScheduledClassMutation = useDeleteScheduledClass();
  const clearScheduledClassesMutation = useClearScheduledClasses();
  const exportScheduleMutation = useExportSchedule();

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
  const [editStartTime, setEditStartTime] = useState('');
  const [editDurationSlots, setEditDurationSlots] = useState(1);
  const [editMode, setEditMode] = useState('sync');

  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<string | null>(null);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Schedule | null>(null);

  const scheduleList = schedules ?? [];
  const totalClasses = scheduleList.length;
  const runId = scheduleList[0]?.run ?? null;

  const normalizedSearch = search.trim().toLowerCase();
  const searchedSchedules = scheduleList.filter((schedule) => {
    if (!normalizedSearch) return true;
    const cleaned = cleanTeacherName(schedule.prof_name).toLowerCase();
    return (
      cleaned.includes(normalizedSearch) ||
      schedule.prof_name.toLowerCase().includes(normalizedSearch)
    );
  });

  const filteredSchedules = searchedSchedules
    .filter(
      (schedule) =>
        dayFilter === 'all' || schedule.day === Number(dayFilter)
    )
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.start_time.localeCompare(b.start_time);
    });

  const dayOptions: SegmentedOption<DayFilter>[] = [
    {
      value: 'all',
      label: 'All days',
      count: searchedSchedules.length,
    },
    ...DAY_LABELS.map((label, index) => ({
      value: String(index) as DayFilter,
      label: label.slice(0, 3),
      count: searchedSchedules.filter((schedule) => schedule.day === index)
        .length,
    })),
  ];

  const handleOpenEdit = (schedule: Schedule) => {
    setEditingClassId(schedule.id);
    setEditProfId(schedule.prof_id ?? null);
    setEditSubjectId(schedule.subject_id ?? null);
    setEditSectionId(schedule.section_id ?? null);
    setEditRoom(schedule.room ?? null);
    setEditDay(schedule.day);
    setEditStartTime(schedule.start_time.slice(0, 5));
    setEditDurationSlots(schedule.duration_slots ?? 1);
    setEditMode(schedule.mode ?? 'sync');
  };

  const closeEditModal = () => {
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

  const handleSaveEdit = () => {
    if (editingClassId === null) return;

    const current = scheduleList.find(
      (schedule) => schedule.id === editingClassId
    );
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
    if (
      editStartTime &&
      editStartTime !== current.start_time.slice(0, 5)
    ) {
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
    if (editSubjectId !== null && editSubjectId !== current.subject_id) {
      updateData.subject_id = editSubjectId;
    }
    if (editSectionId !== null && editSectionId !== current.section_id) {
      updateData.section_id = editSectionId;
    }

    if (Object.keys(updateData).length === 0) {
      closeEditModal();
      return;
    }

    updateScheduledClassMutation.mutate(
      {
        runId: current.run,
        classId: editingClassId,
        data: updateData,
      },
      {
        onSuccess: () => closeEditModal(),
        onError: (error: Error) => {
          setActionError(error.message || 'Failed to update class.');
        },
      }
    );
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    deleteScheduledClassMutation.mutate(
      { runId: pendingDelete.run, classId: pendingDelete.id },
      {
        onSuccess: () => setPendingDelete(null),
        onError: (error: Error) => {
          setPendingDelete(null);
          setActionError(error.message || 'Failed to delete class.');
        },
      }
    );
  };

  const handleConfirmClear = () => {
    if (!runId) return;
    clearScheduledClassesMutation.mutate(runId, {
      onSuccess: () => setClearConfirmOpen(false),
      onError: (error: Error) => {
        setClearConfirmOpen(false);
        setActionError(error.message || 'Failed to clear schedules.');
      },
    });
  };

  const handleExport = async (format: string) => {
    if (!runId) {
      setActionError('No schedule data available to export.');
      setExportOpen(false);
      return;
    }

    setExportFormat(format);
    setExporting(true);

    try {
      const blob = await exportScheduleMutation.mutateAsync({ runId, format });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `timetable.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch {
      setActionError('Failed to export timetable.');
      setExportOpen(false);
    } finally {
      setExporting(false);
      setExportFormat(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDayFilter('all');
  };

  if (isLoading) {
    return (
      <section className='w-full space-y-6'>
        <PageHeader
          eyebrow='Registrar'
          title='Timetable'
          description='Review and adjust the generated class timetable.'
        />
        <LoadingState label='Loading timetable…' />
      </section>
    );
  }

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Registrar'
        title='Timetable'
        description={`${totalClasses} scheduled class${
          totalClasses === 1 ? '' : 's'
        } in the active run.`}
        actions={
          <>
            <Button
              variant='danger'
              icon={<Trash2 size={16} aria-hidden='true' />}
              onClick={() => setClearConfirmOpen(true)}
              disabled={totalClasses === 0}
            >
              Clear all
            </Button>
            <Button
              variant='secondary'
              icon={<Download size={16} aria-hidden='true' />}
              onClick={() => setExportOpen(true)}
              disabled={totalClasses === 0}
            >
              Export
            </Button>
            <LinkButton
              to='/registrar/schedule-management'
              variant='secondary'
              icon={<RefreshCw size={16} aria-hidden='true' />}
            >
              Generate
            </LinkButton>
          </>
        }
      />

      {actionError && (
        <Alert
          tone='danger'
          title='Something went wrong'
          action={
            <IconButton
              label='Dismiss error'
              size='sm'
              onClick={() => setActionError(null)}
            >
              <X size={16} aria-hidden='true' />
            </IconButton>
          }
        >
          {actionError}
        </Alert>
      )}

      {totalClasses === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title='No scheduled classes yet'
          description='Generate a schedule on the Schedule Management page to populate the timetable.'
          action={
            <LinkButton
              to='/registrar/schedule-management'
              icon={<Sparkles size={16} aria-hidden='true' />}
            >
              Generate a schedule
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className='space-y-3 rounded-card border border-border bg-surface p-3 sm:p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
              <TextField
                id='timetable-search'
                label='Filter by professor'
                type='search'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search professor…'
                containerClassName='w-full sm:max-w-xs'
              />
              <p className='text-body-sm text-text-secondary'>
                Showing {filteredSchedules.length} of {totalClasses} classes
              </p>
            </div>
            <SegmentedControl<DayFilter>
              options={dayOptions}
              value={dayFilter}
              onChange={setDayFilter}
              label='Filter timetable by day'
            />
          </div>

          {filteredSchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title='No classes match your filters'
              description='Try a different professor name or day.'
              action={
                <Button variant='secondary' onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className='hidden lg:block'>
                <TableContainer className='max-h-[65vh] overflow-y-auto'>
                  <Table className='min-w-[900px]'>
                    <THead>
                      <TR className='hover:bg-transparent'>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Day
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Time
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Course
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Section
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Professor
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Room
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary'>
                          Mode
                        </TH>
                        <TH className='sticky top-0 z-10 bg-surface-tertiary text-right'>
                          Actions
                        </TH>
                      </TR>
                    </THead>
                    <TBody>
                      {filteredSchedules.map((schedule) => {
                        const subject = splitSubject(schedule.subject_label);
                        return (
                          <TR key={schedule.id}>
                            <TD className='whitespace-nowrap text-text-secondary'>
                              {DAY_LABELS[schedule.day ?? 0]}
                            </TD>
                            <TD className='whitespace-nowrap text-text-secondary'>
                              {formatTime(schedule.start_time)} –{' '}
                              {formatTime(schedule.end_time)}
                            </TD>
                            <TD>
                              <p className='font-medium text-text-primary'>
                                {subject.code}
                              </p>
                              <p className='max-w-[220px] truncate text-caption text-text-secondary'>
                                {subject.title || '—'}
                              </p>
                            </TD>
                            <TD className='text-text-secondary'>
                              {schedule.section_name}
                            </TD>
                            <TD className='text-text-secondary'>
                              {cleanTeacherName(schedule.prof_name)}
                            </TD>
                            <TD className='text-text-secondary'>
                              {schedule.room_name ?? schedule.room ?? '—'}
                            </TD>
                            <TD>
                              <Badge tone='neutral'>
                                {schedule.mode_display ??
                                  schedule.mode ??
                                  '—'}
                              </Badge>
                            </TD>
                            <TD>
                              <div className='flex items-center justify-end gap-1'>
                                <Button
                                  variant='secondary'
                                  size='sm'
                                  icon={
                                    <Pencil size={14} aria-hidden='true' />
                                  }
                                  onClick={() => handleOpenEdit(schedule)}
                                >
                                  Edit
                                </Button>
                                <IconButton
                                  label={`Delete ${subject.code} on ${
                                    DAY_LABELS[schedule.day ?? 0]
                                  }`}
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => setPendingDelete(schedule)}
                                >
                                  <Trash2 size={16} aria-hidden='true' />
                                </IconButton>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableContainer>
              </div>

              <div className='space-y-5 lg:hidden'>
                {DAY_LABELS.map((dayLabel, dayIndex) => {
                  const dayClasses = filteredSchedules.filter(
                    (schedule) => schedule.day === dayIndex
                  );
                  if (dayClasses.length === 0) return null;

                  return (
                    <section key={dayLabel} className='space-y-2'>
                      <h2 className='flex items-center gap-2 text-h3 text-text-primary'>
                        {dayLabel}
                        <Badge tone='neutral'>{dayClasses.length}</Badge>
                      </h2>
                      <ul className='space-y-2'>
                        {dayClasses.map((schedule) => {
                          const subject = splitSubject(schedule.subject_label);
                          return (
                            <li key={schedule.id}>
                              <Card className='p-4'>
                                <div className='flex items-start justify-between gap-3'>
                                  <div className='min-w-0'>
                                    <p className='text-body font-semibold text-text-primary'>
                                      {subject.code}
                                    </p>
                                    <p className='text-body-sm text-text-secondary'>
                                      {subject.title || '—'}
                                    </p>
                                  </div>
                                  <Badge tone='neutral'>
                                    {schedule.mode_display ??
                                      schedule.mode ??
                                      '—'}
                                  </Badge>
                                </div>
                                <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm'>
                                  <div>
                                    <dt className='text-caption text-text-tertiary'>
                                      Time
                                    </dt>
                                    <dd className='text-text-primary'>
                                      {formatTime(schedule.start_time)} –{' '}
                                      {formatTime(schedule.end_time)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className='text-caption text-text-tertiary'>
                                      Room
                                    </dt>
                                    <dd className='text-text-primary'>
                                      {schedule.room_name ??
                                        schedule.room ??
                                        '—'}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className='text-caption text-text-tertiary'>
                                      Section
                                    </dt>
                                    <dd className='text-text-primary'>
                                      {schedule.section_name}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className='text-caption text-text-tertiary'>
                                      Professor
                                    </dt>
                                    <dd className='text-text-primary'>
                                      {cleanTeacherName(schedule.prof_name)}
                                    </dd>
                                  </div>
                                </dl>
                                <div className='mt-3 flex gap-2'>
                                  <Button
                                    variant='secondary'
                                    size='sm'
                                    className='flex-1'
                                    icon={
                                      <Pencil size={14} aria-hidden='true' />
                                    }
                                    onClick={() => handleOpenEdit(schedule)}
                                  >
                                    Edit
                                  </Button>
                                  <IconButton
                                    label={`Delete ${subject.code} on ${dayLabel}`}
                                    variant='secondary'
                                    size='sm'
                                    onClick={() => setPendingDelete(schedule)}
                                  >
                                    <Trash2 size={16} aria-hidden='true' />
                                  </IconButton>
                                </div>
                              </Card>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={exportOpen}
        onClose={() => {
          if (!exporting) setExportOpen(false);
        }}
        title='Export timetable'
        description='Choose a format to download the current timetable.'
        size='sm'
        footer={
          <Button
            variant='secondary'
            onClick={() => setExportOpen(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
        }
      >
        <div className='grid gap-2'>
          <Button
            variant='secondary'
            onClick={() => handleExport('csv')}
            loading={exporting && exportFormat === 'csv'}
            disabled={exporting}
          >
            CSV
          </Button>
          <Button
            variant='secondary'
            onClick={() => handleExport('xlsx')}
            loading={exporting && exportFormat === 'xlsx'}
            disabled={exporting}
          >
            Excel (XLSX)
          </Button>
          <Button
            variant='secondary'
            onClick={() => handleExport('pdf')}
            loading={exporting && exportFormat === 'pdf'}
            disabled={exporting}
          >
            PDF
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        title='Clear all schedules?'
        description={`This removes all ${totalClasses} scheduled class${
          totalClasses === 1 ? '' : 'es'
        } from the active run. This action cannot be undone.`}
        confirmLabel='Clear all'
        loading={clearScheduledClassesMutation.isPending}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title='Delete scheduled class?'
        description={
          pendingDelete
            ? `${splitSubject(pendingDelete.subject_label).code} · Section ${
                pendingDelete.section_name
              } on ${DAY_LABELS[pendingDelete.day ?? 0]} at ${formatTime(
                pendingDelete.start_time
              )} will be removed from the timetable.`
            : ''
        }
        confirmLabel='Delete class'
        loading={deleteScheduledClassMutation.isPending}
      />

      {editingClassId !== null && (
        <Modal
          open
          onClose={closeEditModal}
          title='Edit class'
          description='Update the class details and save your changes.'
          size='lg'
          footer={
            <>
              <Button
                variant='secondary'
                onClick={closeEditModal}
                disabled={updateScheduledClassMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                form={editFormId}
                loading={updateScheduledClassMutation.isPending}
              >
                Save changes
              </Button>
            </>
          }
        >
          <form
            id={editFormId}
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveEdit();
            }}
            className='grid gap-4 sm:grid-cols-2'
          >
            <SelectField
              id='edit-professor'
              label='Professor'
              value={editProfId ?? ''}
              onChange={(event) =>
                setEditProfId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              <option value=''>Select professor</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-subject'
              label='Subject'
              value={editSubjectId ?? ''}
              onChange={(event) =>
                setEditSubjectId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              <option value=''>Select subject</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-section'
              label='Section'
              value={editSectionId ?? ''}
              onChange={(event) =>
                setEditSectionId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              <option value=''>Select section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-room'
              label='Room'
              value={editRoom ?? ''}
              onChange={(event) =>
                setEditRoom(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              <option value=''>Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name || `Room ${room.id}`}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-day'
              label='Day'
              value={editDay ?? ''}
              onChange={(event) =>
                setEditDay(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              {DAY_LABELS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-start-time'
              label='Start time'
              value={editStartTime}
              onChange={(event) => setEditStartTime(event.target.value)}
            >
              <option value=''>Select time</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot.label} value={slot.label}>
                  {slot.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-duration'
              label='Duration'
              value={editDurationSlots}
              onChange={(event) =>
                setEditDurationSlots(Number(event.target.value))
              }
            >
              {DURATION_OPTIONS.map((duration) => (
                <option key={duration} value={duration}>
                  {duration} slot{duration === 1 ? '' : 's'}
                </option>
              ))}
            </SelectField>

            <SelectField
              id='edit-mode'
              label='Mode'
              value={editMode}
              onChange={(event) => setEditMode(event.target.value)}
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </SelectField>

            <TextField
              id='edit-end-time'
              label='End time'
              value={calculateEndTime(editStartTime, editDurationSlots)}
              readOnly
              hint='Calculated from the start time and duration.'
              containerClassName='sm:col-span-2'
            />
          </form>
        </Modal>
      )}
    </section>
  );
}
