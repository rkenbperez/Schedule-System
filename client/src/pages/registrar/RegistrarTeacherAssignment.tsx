// pages/registrar/RegistrarTeacherAssignment.tsx
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, UserRoundX, X } from 'lucide-react';
import ScheduleModal from './components/ScheduleModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingState,
  PageHeader,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui';
import {
  useAllSchedules,
  useCourseAssignmentsByTeacher,
  useCreateRegistrarSchedule,
  useRooms,
  useScheduleRuns,
  useTeachers,
} from '../../hooks/Schedule.hooks';
import type {
  CourseAssignmentDetail,
  CourseAssignmentMeeting,
  ScheduleCreatePayload,
} from '../../types/Types';

type AssignmentMeetingRow = {
  assignment: CourseAssignmentDetail;
  meeting: CourseAssignmentMeeting;
};

export default function RegistrarTeacherAssignment() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const id = teacherId ? Number(teacherId) : undefined;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AssignmentMeetingRow | null>(
    null
  );
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    data: teachers = [],
    isLoading: teachersLoading,
    isError: teachersError,
  } = useTeachers({ enabled: true });
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    isError: assignmentsError,
  } = useCourseAssignmentsByTeacher({
    teacherId: id,
    enabled: id !== undefined,
  });
  const { data: schedules = [], isLoading: schedulesLoading } = useAllSchedules({
    enabled: id !== undefined,
  });
  const { data: runs = [], isLoading: runsLoading } = useScheduleRuns({
    enabled: id !== undefined,
  });
  const { data: rooms = [] } = useRooms({ enabled: true });
  const createSchedule = useCreateRegistrarSchedule();

  const teacher = teachers.find((candidate) => candidate.id === id);
  // Prefer a run for the open assignment's term; the newest run globally may
  // belong to a different term.
  const activeRun =
    runs.find((run) => run.term === selectedRow?.assignment.term) ?? runs[0];

  const rows = useMemo<AssignmentMeetingRow[]>(
    () =>
      assignments.flatMap((assignment) =>
        (assignment.meetings ?? []).map((meeting) => ({
          assignment,
          meeting,
        }))
      ),
    [assignments]
  );

  const isMeetingScheduled = (assignmentId: number, mode: string) =>
    schedules.some(
      (schedule) =>
        schedule.assignment === assignmentId &&
        (!schedule.mode || schedule.mode === mode)
    );

  const openModal = (row: AssignmentMeetingRow) => {
    setSelectedRow(row);
    setIsModalOpen(true);
    setNotification(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const handleSchedule = async (payload: ScheduleCreatePayload) => {
    if (!activeRun) {
      setNotification({
        type: 'error',
        message:
          'No schedule run is available. Generate a schedule before assigning classes.',
      });
      return;
    }

    try {
      await createSchedule.mutateAsync({ runId: activeRun.id, payload });
      setNotification({
        type: 'success',
        message: 'Schedule created successfully.',
      });
      closeModal();
    } catch (err) {
      setNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to create schedule.',
      });
    }
  };

  const clearNotification = () => setNotification(null);
  const teacherName = teacher?.full_name ?? (id ? `Teacher #${id}` : null);
  const isLoading =
    teachersLoading || assignmentsLoading || schedulesLoading || runsLoading;
  const isError = teachersError || assignmentsError;

  if (id === undefined) {
    return (
      <section className='w-full space-y-6'>
        <PageHeader
          backTo='/registrar/teachers'
          backLabel='Back to teachers'
          eyebrow='Registrar'
          title='Teacher assignments'
        />
        <EmptyState
          icon={UserRoundX}
          title='No teacher selected'
          description='Choose a teacher from the list to view and schedule their course assignments.'
        />
      </section>
    );
  }

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        backTo='/registrar/teachers'
        backLabel='Back to teachers'
        eyebrow='Registrar'
        title={teacherName ?? 'Teacher assignments'}
        description={
          teacher
            ? `${teacher.department_name || 'Unassigned department'} · ${assignments.length} course assignment${
                assignments.length === 1 ? '' : 's'
              }`
            : 'Review course assignments and create class schedules.'
        }
      />

      {notification && (
        <Alert
          tone={notification.type === 'success' ? 'success' : 'danger'}
          title={
            notification.type === 'success'
              ? 'Schedule created'
              : 'Could not create schedule'
          }
          action={
            <IconButton
              label='Dismiss notification'
              size='sm'
              onClick={clearNotification}
            >
              <X size={16} aria-hidden='true' />
            </IconButton>
          }
        >
          {notification.message}
        </Alert>
      )}

      {isLoading ? (
        <LoadingState label='Loading teacher assignments…' />
      ) : isError ? (
        <Alert tone='danger' title='Unable to load teacher assignments'>
          Please refresh the page or try again later.
        </Alert>
      ) : !teacher ? (
        <EmptyState
          icon={UserRoundX}
          title='Teacher not found'
          description='This teacher may have been removed. Choose another teacher from the list.'
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title='No assignments yet'
          description={`No course assignments found for ${teacher.full_name}.`}
        />
      ) : (
        <>
          <div className='hidden lg:block'>
            <TableContainer>
              <Table className='min-w-[760px]'>
                <THead>
                  <TR className='hover:bg-transparent'>
                    <TH>Teacher</TH>
                    <TH>Course</TH>
                    <TH>Section</TH>
                    <TH>Meeting</TH>
                    <TH>Status</TH>
                    <TH className='text-right'>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map(({ assignment, meeting }) => {
                    const isScheduled = isMeetingScheduled(
                      assignment.id,
                      meeting.mode
                    );
                    return (
                      <TR key={`${assignment.id}-${meeting.id}`}>
                        <TD className='font-medium'>{assignment.prof_name}</TD>
                        <TD>{assignment.subject_label}</TD>
                        <TD className='text-text-secondary'>
                          {assignment.section_name}
                        </TD>
                        <TD className='text-text-secondary'>
                          {meeting.mode_display} · {meeting.duration_slots}h
                        </TD>
                        <TD>
                          <Badge tone={isScheduled ? 'success' : 'neutral'}>
                            {isScheduled ? 'Scheduled' : 'Unscheduled'}
                          </Badge>
                        </TD>
                        <TD className='text-right'>
                          <Button
                            variant='secondary'
                            size='sm'
                            icon={<CalendarPlus size={15} aria-hidden='true' />}
                            onClick={() => openModal({ assignment, meeting })}
                          >
                            {isScheduled ? 'Reschedule' : 'Schedule'}
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
          </div>

          <ul className='space-y-3 lg:hidden'>
            {rows.map(({ assignment, meeting }) => {
              const isScheduled = isMeetingScheduled(
                assignment.id,
                meeting.mode
              );
              return (
                <li key={`${assignment.id}-${meeting.id}`}>
                  <Card className='p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className='text-h3 text-text-primary'>
                          {assignment.subject_label}
                        </p>
                        <p className='mt-0.5 text-body-sm text-text-secondary'>
                          Section {assignment.section_name} ·{' '}
                          {meeting.mode_display} · {meeting.duration_slots}h
                        </p>
                      </div>
                      <Badge tone={isScheduled ? 'success' : 'neutral'}>
                        {isScheduled ? 'Scheduled' : 'Unscheduled'}
                      </Badge>
                    </div>
                    <p className='mt-3 text-body-sm text-text-secondary'>
                      {assignment.prof_name}
                    </p>
                    <Button
                      variant='secondary'
                      className='mt-4 w-full'
                      icon={<CalendarPlus size={16} aria-hidden='true' />}
                      onClick={() => openModal({ assignment, meeting })}
                    >
                      {isScheduled ? 'Reschedule' : 'Schedule'}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {isModalOpen && selectedRow && (
        <ScheduleModal
          teacherName={teacherName ?? `Teacher #${selectedRow.assignment.prof}`}
          meeting={selectedRow.meeting}
          assignment={selectedRow.assignment}
          rooms={rooms}
          activeRunId={activeRun?.id ?? null}
          isSubmitting={createSchedule.isPending}
          onSchedule={handleSchedule}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
