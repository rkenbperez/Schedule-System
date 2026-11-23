import { CalendarDays, Clock3 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useRoomSchedule, useRooms } from '../../hooks/Schedule.hooks';
import {
  Badge,
  Card,
  EmptyState,
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
import type { Schedule } from '../../types/Types';

// Mock example data for testing without backend.
const exampleSchedules: Schedule[] = [
  {
    id: 1,
    run: 1,
    assignment: 1,
    assignment_label: 'COSC 7 - 3-A',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7 - Data Structures and Algorithms',
    room: 101,
    room_name: 'Room 101',
    day: 0,
    day_display: 'Monday',
    start_time: '07:00',
    end_time: '09:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
  {
    id: 2,
    run: 1,
    assignment: 2,
    assignment_label: 'COSC 7 - Lab 202',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7 - Data Structures and Algorithms',
    room: 103,
    room_name: 'Lab 202',
    day: 2,
    day_display: 'Wednesday',
    start_time: '13:00',
    end_time: '17:00',
    duration_slots: 4,
    mode: 'lab',
    mode_display: 'Laboratory',
    term: 1,
  },
];

function formatTime(time: string) {
  const [rawHours, rawMinutes = '0'] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  const period = hours < 12 ? 'AM' : 'PM';
  const display = hours % 12 === 0 ? 12 : hours % 12;

  return `${display}:${String(minutes).padStart(2, '0')} ${period}`;
}

export default function TeacherRoomDetailPage() {
  const { roomId, name: teacherName } = useParams<{
    roomId: string;
    name: string;
  }>();
  const id = roomId ? Number(roomId) : undefined;
  const teacher = teacherName ?? 'juan';

  const { data: rooms } = useRooms({ enabled: true });
  const room = rooms?.find((candidate) => candidate.id === id);

  const { data: schedules, isLoading } = useRoomSchedule({
    roomId: id,
    enabled: !!id,
  });

  const resolvedSchedules: Schedule[] =
    schedules ?? exampleSchedules.filter((schedule) => schedule.room === id);

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title={room ? `Room ${room.name}` : 'Room schedule'}
        description={
          room
            ? `${room.building}${room.department_name ? ` · ${room.department_name}` : ''}`
            : undefined
        }
        backTo={`/teacher/${teacher}/rooms`}
        backLabel='Back to rooms'
      />

      {!id ? (
        <EmptyState
          icon={CalendarDays}
          title='No room selected'
          description='Choose a room to view its schedule.'
        />
      ) : !room ? (
        <EmptyState
          icon={CalendarDays}
          title='Room not found'
          description='This room may have been removed or is no longer available.'
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            {[
              { label: 'Room', value: room.name },
              { label: 'Capacity', value: `${room.capacity} students` },
              { label: 'Building', value: room.building },
              { label: 'Department', value: room.department_name || '—' },
            ].map((item) => (
              <Card key={item.label} className='p-4'>
                <p className='text-caption uppercase tracking-wide text-text-tertiary'>
                  {item.label}
                </p>
                <p className='mt-1 text-body font-semibold text-text-primary'>
                  {item.value}
                </p>
              </Card>
            ))}
          </div>

          {isLoading ? (
            <LoadingState label='Loading room schedule…' />
          ) : resolvedSchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title='No scheduled classes'
              description='This room has no classes scheduled for the current term.'
            />
          ) : (
            <>
              <TableContainer className='hidden md:block'>
                <Table className='min-w-[760px]'>
                  <caption className='sr-only'>
                    Weekly schedule for {room.name}
                  </caption>
                  <THead>
                    <TR>
                      <TH>Day</TH>
                      <TH>Time</TH>
                      <TH>Course</TH>
                      <TH>Section</TH>
                      <TH>Professor</TH>
                      <TH>Mode</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {resolvedSchedules.map((schedule) => (
                      <TR key={schedule.id}>
                        <TD className='text-text-secondary'>
                          {schedule.day_display}
                        </TD>
                        <TD className='whitespace-nowrap text-text-secondary'>
                          {formatTime(schedule.start_time)}
                          {schedule.end_time
                            ? ` – ${formatTime(schedule.end_time)}`
                            : ''}
                        </TD>
                        <TD className='font-medium'>
                          {schedule.subject_label}
                        </TD>
                        <TD className='text-text-secondary'>
                          {schedule.section_name}
                        </TD>
                        <TD className='text-text-secondary'>
                          {schedule.prof_name}
                        </TD>
                        <TD>
                          <Badge tone='green'>{schedule.mode_display}</Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>

              <div className='space-y-3 md:hidden'>
                {resolvedSchedules.map((schedule) => (
                  <Card key={schedule.id} className='p-4'>
                    <div className='flex flex-wrap items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='text-body font-semibold text-text-primary'>
                          {schedule.subject_label}
                        </p>
                        <p className='text-body-sm text-text-secondary'>
                          Section {schedule.section_name}
                        </p>
                      </div>
                      <Badge tone='green'>{schedule.mode_display}</Badge>
                    </div>

                    <dl className='mt-3 grid grid-cols-2 gap-3 border-t border-border-light pt-3'>
                      <div className='flex items-start gap-2'>
                        <CalendarDays
                          size={15}
                          className='mt-0.5 shrink-0 text-apple-green-600'
                          aria-hidden='true'
                        />
                        <div>
                          <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                            Day
                          </dt>
                          <dd className='text-body-sm text-text-primary'>
                            {schedule.day_display}
                          </dd>
                        </div>
                      </div>
                      <div className='flex items-start gap-2'>
                        <Clock3
                          size={15}
                          className='mt-0.5 shrink-0 text-apple-green-600'
                          aria-hidden='true'
                        />
                        <div>
                          <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                            Time
                          </dt>
                          <dd className='text-body-sm text-text-primary'>
                            {formatTime(schedule.start_time)}
                            {schedule.end_time
                              ? ` – ${formatTime(schedule.end_time)}`
                              : ''}
                          </dd>
                        </div>
                      </div>
                      <div className='col-span-2'>
                        <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                          Professor
                        </dt>
                        <dd className='text-body-sm text-text-primary'>
                          {schedule.prof_name}
                        </dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
