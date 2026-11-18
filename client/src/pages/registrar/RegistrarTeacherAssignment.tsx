// pages/registrar/RegistrarTeacherAssignment.tsx
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import ScheduleModal from './components/ScheduleModal';
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

  // Hook: /api/professor/me/ takes NO parameter — it returns the currently
  // logged-in professor ("me"), not a teacher you specify by ID.
  // To fetch a specific teacher's assignments by ID, the backend would need
  // an endpoint such as GET /api/assignments/?prof_id={teacherId}.
  // Commented out for now — using mock data below for testing.
  /*
  const {
    data: professorProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useProfessorProfile({ enabled: !!id });
  */

  // Mock example data (retained for testing / offline use)
  const mockAssignments: CourseAssignmentDetail[] = exampleAssignments.filter(
    (a) => a.prof === id
  );
  const mockTeacher = exampleTeachers.find((t) => t.id === id);

  const teacherAssignments: CourseAssignmentDetail[] = mockAssignments;
  const teacher = mockTeacher;

  // Modal state
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

  return (
    <section className='w-full'>
      <div className='mb-5 flex items-center gap-2'>
        <Link
          to='/registrar/teachers'
          className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <ArrowLeft size={15} /> Back to teachers
        </Link>
        <h1 className='text-lg font-medium text-text-primary ml-auto'>
          Teacher Assignments
        </h1>
      </div>

      {notification && (
        <div
          className={`rounded-lg border p-3 mb-4 text-sm flex items-start gap-3 ${
            notification.type === 'success'
              ? 'bg-apple-green-50 border-apple-green-100 text-apple-green-700'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
          role='alert'
        >
          <span className='shrink-0 mt-0.5'>
            {notification.type === 'success' ? '✓' : '✕'}
          </span>
          <p className='text-text-primary'>{notification.message}</p>
          <button
            type='button'
            onClick={clearNotification}
            className='ml-auto text-text-tertiary hover:text-text-primary'
          >
            ✕
          </button>
        </div>
      )}

      {id === undefined ? (
        <p className='text-sm text-text-secondary'>No teacher selected.</p>
      ) : teacherAssignments.length === 0 ? (
        <div className='rounded-card border border-border bg-surface p-8 text-center'>
          <p className='text-sm text-text-secondary'>
            No assignments found for {teacher?.full_name ?? 'this teacher'}.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-card border border-border bg-surface'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border text-left text-text-secondary'>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Teacher
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Course
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Section
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Program
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Type
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal'>
                  Status
                </th>
                <th scope='col' className='px-4 py-2.5 font-normal text-right'>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {teacherAssignments.map((a: CourseAssignmentDetail) => {
                return (
                  <tr
                    key={a.id}
                    className='border-t border-border cursor-pointer hover:bg-surface-secondary transition'
                  >
                    <td
                      className='px-4 py-3 text-text-primary'
                      onClick={() => openModal(a)}
                    >
                      {a.prof_name}
                    </td>
                    <td
                      className='px-4 py-3 text-text-primary'
                      onClick={() => openModal(a)}
                    >
                      {a.subject_label}
                    </td>
                    <td
                      className='px-4 py-3 text-text-secondary'
                      onClick={() => openModal(a)}
                    >
                      {a.section_name}
                    </td>
                    <td
                      className='px-4 py-3 text-text-secondary'
                      onClick={() => openModal(a)}
                    >
                      {a.section_name}
                    </td>
                    <td
                      className='px-4 py-3 text-text-secondary'
                      onClick={() => openModal(a)}
                    >
                      {a.meetings?.[0]?.mode_display || '—'}
                    </td>
                    <td
                      className='px-4 py-3 text-text-secondary'
                      onClick={() => openModal(a)}
                    >
                      {a.meetings?.[0]
                        ? 'Scheduled'
                        : 'Unscheduled'}
                    </td>
                    <td
                      className='px-4 py-3 text-right'
                      onClick={() => openModal(a)}
                    >
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(a);
                        }}
                        className='inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        {a.meetings?.[0] ? 'Reschedule' : 'Schedule'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && selectedAssignment && (
        <ScheduleModal
          teacherId={selectedAssignment.prof}
          component={
            selectedAssignment.meetings?.[0]?.mode_display
              ? exampleComponents[0]
              : exampleComponents[0]
          }
          assignment={selectedAssignment}
          rooms={exampleRooms}
          onSchedule={handleSchedule}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
