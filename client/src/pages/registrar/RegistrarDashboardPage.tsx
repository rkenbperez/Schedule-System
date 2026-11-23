import { useState } from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useTeachers,
  useAllAssignments,
  useAllSchedules,
} from '../../hooks/Registrar.hooks';
import { useExportSchedule } from '../../hooks/GenerateManagement.hooks';
import type {
  CourseAssignmentDetail,
  Schedule,
  TeacherListItem,
} from '../../types/Types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  LinkButton,
  LoadingState,
  Modal,
  PageHeader,
  StatCard,
} from '../../components/ui';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

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
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loading = teachersLoading || assignmentsLoading || schedulesLoading;
  const error = teachersError || assignmentsError || schedulesError;

  const teachersList: TeacherListItem[] = teachers ?? [];
  const allAssignments: CourseAssignmentDetail[] = assignments ?? [];
  const allSchedules: Schedule[] = schedules ?? [];

  const scheduledAssignmentIds = new Set(
    allSchedules.map((schedule: Schedule) => schedule.assignment)
  );
  const unscheduledCount = allAssignments.filter(
    (assignment: CourseAssignmentDetail) =>
      !scheduledAssignmentIds.has(assignment.id)
  ).length;
  const runId = allSchedules.length > 0 ? allSchedules[0].run : null;

  async function handleExport(format: string) {
    if (!runId) {
      setExportError('No schedule data is available to export yet.');
      return;
    }

    setExportError(null);
    setExportingFormat(format);

    try {
      const blob = await exportScheduleMutation.mutateAsync({ runId, format });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `timetable.${format === 'xlsx' ? 'xlsx' : format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExportPanelOpen(false);
    } catch {
      setExportError('Failed to export the timetable. Please try again.');
    } finally {
      setExportingFormat(null);
    }
  }

  function retryAll() {
    refetchTeachers();
    refetchAssignments();
    refetchSchedules();
  }

  if (error) {
    return (
      <div className='space-y-6'>
        <PageHeader
          title='Registrar dashboard'
          description='1st semester, 2026–2027'
        />
        <Alert
          tone='danger'
          title='Failed to load registrar data'
          action={
            <Button variant='secondary' size='sm' onClick={retryAll}>
              Retry
            </Button>
          }
        >
          {error.message ?? 'Unable to load data from the API.'}
        </Alert>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Registrar dashboard'
        description='1st semester, 2026–2027 · A snapshot of teaching load and schedule progress.'
        actions={
          <>
            <LinkButton
              to='/registrar/timetable'
              variant='secondary'
              icon={<CalendarDays size={17} aria-hidden='true' />}
            >
              View timetable
            </LinkButton>
            <Button
              variant='primary'
              icon={<Download size={17} aria-hidden='true' />}
              onClick={() => {
                setExportError(null);
                setExportPanelOpen(true);
              }}
              disabled={!runId}
              title={!runId ? 'No schedule data to export yet' : undefined}
            >
              Export
            </Button>
          </>
        }
      />

      {loading ? (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
          <LoadingState label='Loading teachers and assignments…' />
        </>
      ) : (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            <StatCard
              icon={Users}
              label='Teachers'
              value={teachersList.length}
              hint='Active teaching staff'
            />
            <StatCard
              icon={BookOpen}
              label='Assignments'
              value={allAssignments.length}
              hint='Course sections this term'
            />
            <StatCard
              icon={Clock}
              label='Unscheduled meetings'
              value={unscheduledCount}
              hint={unscheduledCount > 0 ? 'Needs attention' : 'All scheduled'}
            />
            <StatCard
              icon={Activity}
              label='Schedules created'
              value={allSchedules.length}
              hint='Classes placed in the timetable'
            />
          </div>

          <section className='space-y-4'>
            <div className='flex flex-wrap items-end justify-between gap-2'>
              <div>
                <h2 className='text-h2 text-text-primary'>
                  Teachers and assignments
                </h2>
                <p className='mt-0.5 text-body-sm text-text-secondary'>
                  Open a teacher to review or adjust their schedule.
                </p>
              </div>
              <Badge tone='neutral' size='md'>
                {teachersList.length} teachers
              </Badge>
            </div>

            {teachersList.length === 0 ? (
              <EmptyState
                icon={Users}
                title='No teachers yet'
                description='Teachers will appear here once they are added to the system.'
              />
            ) : (
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {teachersList.map((teacher: TeacherListItem) => {
                  const teacherAssignments = allAssignments.filter(
                    (assignment: CourseAssignmentDetail) =>
                      assignment.prof === teacher.id
                  );
                  const teacherUnscheduled = teacherAssignments.filter(
                    (assignment: CourseAssignmentDetail) =>
                      !allSchedules.some(
                        (schedule: Schedule) =>
                          schedule.assignment === assignment.id
                      )
                  ).length;
                  const visibleAssignments = teacherAssignments.slice(0, 4);
                  const remaining = teacherAssignments.length - visibleAssignments.length;

                  return (
                    <Card key={teacher.id} className='flex min-w-0 flex-col'>
                      <Link
                        to={`/registrar/teachers/${teacher.id}`}
                        className='flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-surface-secondary'
                      >
                        <div className='flex min-w-0 items-center gap-3'>
                          <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-apple-green-50 text-body-sm font-semibold text-apple-green-700'>
                            {initialsOf(teacher.full_name)}
                          </span>
                          <div className='min-w-0'>
                            <p className='truncate text-body font-semibold text-text-primary'>
                              {teacher.full_name}
                            </p>
                            <p className='truncate text-caption text-text-tertiary'>
                              {teacherAssignments.length}{' '}
                              {teacherAssignments.length === 1
                                ? 'assignment'
                                : 'assignments'}
                              {teacher.department_name
                                ? ` · ${teacher.department_name}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className='flex shrink-0 items-center gap-2'>
                          {teacherUnscheduled > 0 ? (
                            <Badge tone='warning'>
                              {teacherUnscheduled} pending
                            </Badge>
                          ) : (
                            <Badge tone='success'>All scheduled</Badge>
                          )}
                          <ChevronRight
                            size={17}
                            className='text-text-tertiary'
                            aria-hidden='true'
                          />
                        </div>
                      </Link>

                      {visibleAssignments.length === 0 ? (
                        <p className='px-4 py-6 text-center text-body-sm text-text-tertiary'>
                          No assignments this term.
                        </p>
                      ) : (
                        <ul className='divide-y divide-border-light'>
                          {visibleAssignments.map(
                            (assignment: CourseAssignmentDetail) => {
                              const schedule = allSchedules.find(
                                (item: Schedule) =>
                                  item.assignment === assignment.id
                              );

                              return (
                                <li
                                  key={assignment.id}
                                  className='flex min-w-0 flex-col gap-1 px-4 py-3'
                                >
                                  <div className='flex min-w-0 items-baseline justify-between gap-2'>
                                    <span className='min-w-0 truncate text-body-sm font-medium text-text-primary'>
                                      {assignment.subject_label}
                                    </span>
                                    <span className='shrink-0 text-caption text-text-tertiary'>
                                      Sec. {assignment.section_name}
                                    </span>
                                  </div>

                                  <div className='flex flex-wrap items-center gap-2'>
                                    <Badge
                                      tone={schedule ? 'success' : 'warning'}
                                    >
                                      {schedule ? 'Scheduled' : 'Pending'}
                                    </Badge>
                                    <span className='text-caption text-text-tertiary'>
                                      {assignment.meetings?.[0]?.mode_display ??
                                        'Class'}
                                    </span>
                                  </div>

                                  {schedule && (
                                    <span className='text-caption text-text-secondary'>
                                      {schedule.day_display},{' '}
                                      {schedule.start_time}
                                      {schedule.room_name
                                        ? ` · ${schedule.room_name}`
                                        : ''}
                                    </span>
                                  )}
                                </li>
                              );
                            }
                          )}
                        </ul>
                      )}

                      {remaining > 0 && (
                        <Link
                          to={`/registrar/teachers/${teacher.id}`}
                          className='mt-auto inline-flex min-h-11 items-center gap-1 border-t border-border px-4 text-body-sm font-medium text-apple-green-700 transition-colors hover:bg-apple-green-50'
                        >
                          View {remaining} more assignment
                          {remaining === 1 ? '' : 's'}
                          <ChevronRight size={15} aria-hidden='true' />
                        </Link>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={exportPanelOpen}
        onClose={() => {
          if (!exportingFormat) setExportPanelOpen(false);
        }}
        title='Export timetable'
        description='Choose a format to download the current timetable.'
        size='sm'
      >
        <div className='space-y-4'>
          {exportError && <Alert tone='danger'>{exportError}</Alert>}

          <div className='grid gap-2'>
            {[
              { format: 'csv', label: 'CSV spreadsheet' },
              { format: 'xlsx', label: 'Excel workbook (XLSX)' },
              { format: 'pdf', label: 'PDF document' },
            ].map((option) => (
              <Button
                key={option.format}
                variant='secondary'
                className='w-full justify-between'
                loading={exportingFormat === option.format}
                disabled={exportingFormat !== null && exportingFormat !== option.format}
                onClick={() => handleExport(option.format)}
              >
                {option.label}
                <Download size={16} aria-hidden='true' />
              </Button>
            ))}
          </div>

          <p className='text-caption text-text-tertiary'>
            Exports use the most recently generated schedule.
          </p>
        </div>
      </Modal>
    </div>
  );
}
