// pages/registrar/RegistrarTeacherAssignment.tsx
import { useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, UserRoundX, X } from 'lucide-react';
import { useState } from 'react';
import ScheduleModal from './components/ScheduleModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui';
import { scheduleService } from '../../services/Schedule.service';
import type {
  CourseAssignmentDetail,
  Room,
  RoomType,
  CourseComponent,
  Course,
  TeacherProfile,
} from '../../types/Types';

// Example (mock) data matching backend API response structure.
const exampleCourses: Course[] = [
  {
    id: 1,
    code: 'COSC 7',
    title: 'Data Structures and Algorithms',
    units: '3.0',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 2,
    code: 'DCIT 5',
    title: 'Database Management Systems',
    units: '3.0',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 3,
    code: 'MATH 10',
    title: 'Calculus II',
    units: '4.0',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
];

const exampleRoomTypes: RoomType[] = [
  { id: 1, name: 'lecture' },
  { id: 2, name: 'laboratory' },
];

const exampleRooms: Room[] = [
  {
    id: 101,
    name: 'Room 101',
    capacity: 40,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 102,
    name: 'Room 204',
    capacity: 35,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 103,
    name: 'Lab 202',
    capacity: 30,
    department: 1,
    department_name: 'BSIT',
    building: 'Engineering Building',
  },
  {
    id: 104,
    name: 'Room 305',
    capacity: 45,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 105,
    name: 'Lab 301',
    capacity: 25,
    department: 1,
    department_name: 'BSIT',
    building: 'Engineering Building',
  },
];

const exampleTeachers: TeacherProfile[] = [
  {
    id: 1,
    username: 'angel.cruz',
    full_name: 'Angel Cruz',
    department: 1,
    department_name: 'BSIT',
    max_daily_hours: 8,
    max_consecutive: 3,
    user: {
      id: 1,
      username: 'angel.cruz',
      full_name: 'Angel Cruz',
      email: 'angel.cruz@school.edu',
    },
  },
  {
    id: 2,
    username: 'maria.santos',
    full_name: 'Maria Santos',
    department: 1,
    department_name: 'BSIT',
    max_daily_hours: 8,
    max_consecutive: 3,
    user: {
      id: 2,
      username: 'maria.santos',
      full_name: 'Maria Santos',
      email: 'maria.santos@school.edu',
    },
  },
  {
    id: 3,
    username: 'robert.reyes',
    full_name: 'Robert Reyes',
    department: 1,
    department_name: 'BSIT',
    max_daily_hours: 8,
    max_consecutive: 3,
    user: {
      id: 3,
      username: 'robert.reyes',
      full_name: 'Robert Reyes',
      email: 'robert.reyes@school.edu',
    },
  },
  {
    id: 4,
    username: 'elena.garcia',
    full_name: 'Elena Garcia',
    department: null,
    department_name: '',
    max_daily_hours: 8,
    max_consecutive: 3,
    user: {
      id: 4,
      username: 'elena.garcia',
      full_name: 'Elena Garcia',
      email: 'elena.garcia@school.edu',
    },
  },
];

const exampleComponents: CourseComponent[] = [
  {
    id: 1,
    course: exampleCourses[0],
    room_type: exampleRoomTypes[0],
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 2,
    course: exampleCourses[0],
    room_type: exampleRoomTypes[1],
    label: 'laboratory',
    duration: 4,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 3,
    course: exampleCourses[1],
    room_type: exampleRoomTypes[0],
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 4,
    course: exampleCourses[1],
    room_type: exampleRoomTypes[1],
    label: 'laboratory',
    duration: 4,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 5,
    course: exampleCourses[2],
    room_type: exampleRoomTypes[0],
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
];

const exampleAssignments: CourseAssignmentDetail[] = [
  {
    id: 1,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [
      {
        id: 1,
        order: 1,
        mode: 'sync',
        mode_display: 'Synchronous',
        duration_slots: 2,
      },
    ],
    prof_name: 'Angel Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 2,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [
      {
        id: 2,
        order: 2,
        mode: 'lab',
        mode_display: 'Laboratory',
        duration_slots: 4,
      },
    ],
    prof_name: 'Angel Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 3,
    prof: 1,
    subject: 2,
    section: 2,
    term: 1,
    meetings: [
      {
        id: 3,
        order: 1,
        mode: 'sync',
        mode_display: 'Synchronous',
        duration_slots: 2,
      },
    ],
    prof_name: 'Angel Cruz',
    subject_label: 'DCIT 5',
    section_name: '2-B',
  },
  {
    id: 4,
    prof: 2,
    subject: 3,
    section: 1,
    term: 1,
    meetings: [
      {
        id: 4,
        order: 1,
        mode: 'sync',
        mode_display: 'Synchronous',
        duration_slots: 2,
      },
    ],
    prof_name: 'Maria Santos',
    subject_label: 'MATH 10',
    section_name: '3-A',
  },
  {
    id: 5,
    prof: 2,
    subject: 4,
    section: 3,
    term: 1,
    meetings: [
      {
        id: 5,
        order: 1,
        mode: 'sync',
        mode_display: 'Synchronous',
        duration_slots: 2,
      },
    ],
    prof_name: 'Maria Santos',
    subject_label: 'GNED 12',
    section_name: '1-C',
  },
  {
    id: 6,
    prof: 3,
    subject: 5,
    section: 2,
    term: 1,
    meetings: [
      {
        id: 6,
        order: 1,
        mode: 'sync',
        mode_display: 'Synchronous',
        duration_slots: 2,
      },
    ],
    prof_name: 'Robert Reyes',
    subject_label: 'PHYS 3',
    section_name: '2-B',
  },
  {
    id: 7,
    prof: 3,
    subject: 5,
    section: 2,
    term: 1,
    meetings: [
      {
        id: 7,
        order: 2,
        mode: 'lab',
        mode_display: 'Laboratory',
        duration_slots: 4,
      },
    ],
    prof_name: 'Robert Reyes',
    subject_label: 'PHYS 3',
    section_name: '2-B',
  },
];

export default function RegistrarTeacherAssignment() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const id = teacherId ? Number(teacherId) : undefined;

  // Mock example data (retained for testing / offline use)
  const mockAssignments: CourseAssignmentDetail[] = exampleAssignments.filter(
    (a) => a.prof === id
  );
  const mockTeacher = exampleTeachers.find((t) => t.id === id);

  const teacherAssignments: CourseAssignmentDetail[] = mockAssignments;
  const teacher = mockTeacher;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<CourseAssignmentDetail | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const openModal = (assignment: CourseAssignmentDetail) => {
    setSelectedAssignment(assignment);
    setIsModalOpen(true);
    setNotification(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAssignment(null);
  };

  const handleSchedule = async (payload: {
    course_assignment: number;
    course_component: number;
    room: number;
    start_time: string;
    day_of_week: number;
  }) => {
    try {
      await scheduleService.createSchedule(payload);
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
        title={teacherName}
        description={
          teacher
            ? `${teacher.department_name || 'Unassigned department'} · ${teacherAssignments.length} course assignment${
                teacherAssignments.length === 1 ? '' : 's'
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

      {teacherAssignments.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title='No assignments yet'
          description={`No course assignments found for ${
            teacher?.full_name ?? 'this teacher'
          }.`}
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
                  {teacherAssignments.map((assignment) => {
                    const isScheduled = Boolean(assignment.meetings?.length);
                    return (
                      <TR key={assignment.id}>
                        <TD className='font-medium'>
                          {assignment.prof_name}
                        </TD>
                        <TD>{assignment.subject_label}</TD>
                        <TD className='text-text-secondary'>
                          {assignment.section_name}
                        </TD>
                        <TD className='text-text-secondary'>
                          {assignment.meetings?.[0]?.mode_display ?? '—'}
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
                            onClick={() => openModal(assignment)}
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
            {teacherAssignments.map((assignment) => {
              const isScheduled = Boolean(assignment.meetings?.length);
              return (
                <li key={assignment.id}>
                  <Card className='p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className='text-h3 text-text-primary'>
                          {assignment.subject_label}
                        </p>
                        <p className='mt-0.5 text-body-sm text-text-secondary'>
                          Section {assignment.section_name} ·{' '}
                          {assignment.meetings?.[0]?.mode_display ?? 'No meeting'}
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
                      onClick={() => openModal(assignment)}
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

      {isModalOpen && selectedAssignment && (
        <ScheduleModal
          teacherId={selectedAssignment.prof}
          component={exampleComponents[0]}
          assignment={selectedAssignment}
          rooms={exampleRooms}
          onSchedule={handleSchedule}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
