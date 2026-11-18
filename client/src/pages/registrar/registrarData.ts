// pages/registrar/registrarData.ts
// Example data matching the backend API response structure.
// Use this for frontend testing until the Django backend is fully implemented.

import type {
  TeacherListItem,
  CourseAssignmentDetail,
  Schedule,
  CourseComponent,
  Room,
  RoomType,
  AcademicTerm,
  Section,
  Course,
} from '../../types/Types';

export const registrarTerms: AcademicTerm[] = [
  {
    id: 1,
    name: '1st Semester',
    school_year: '2026-2027',
    term_type: 'regular',
    start_date: '2026-08-01',
    end_date: '2026-12-20',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 2,
    name: '2nd Semester',
    school_year: '2026-2027',
    term_type: 'regular',
    start_date: '2027-01-10',
    end_date: '2027-05-20',
    is_active: false,
    created_at: '2026-07-15T00:00:00Z',
  },
];

export const registrarRoomTypes: RoomType[] = [
  { id: 1, name: 'lecture' },
  { id: 2, name: 'laboratory' },
];

export const registrarRooms: Room[] = [
  { id: 101, name: 'Room 101', capacity: 40, department: 1, department_name: 'BSIT', building: 'Main Building' },
  { id: 102, name: 'Room 204', capacity: 35, department: 1, department_name: 'BSIT', building: 'Main Building' },
  { id: 103, name: 'Lab 202', capacity: 30, department: 1, department_name: 'BSIT', building: 'Engineering Building' },
  { id: 104, name: 'Room 305', capacity: 45, department: 1, department_name: 'BSIT', building: 'Main Building' },
  { id: 105, name: 'Lab 301', capacity: 25, department: 1, department_name: 'BSIT', building: 'Engineering Building' },
];

export const registrarCourses: Course[] = [
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
  {
    id: 4,
    code: 'GNED 12',
    title: 'Ethics',
    units: '3.0',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 5,
    code: 'PHYS 3',
    title: 'General Physics',
    units: '3.0',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
];

export const registrarSections: Section[] = [
  { id: 1, name: '3-A', headcount: 30, program: 'BSIT', year_level: 3, term: 1 },
  { id: 2, name: '2-B', headcount: 28, program: 'BSIT', year_level: 2, term: 1 },
  { id: 3, name: '1-C', headcount: 40, program: 'BSEE', year_level: 1, term: 1 },
];

export const registrarTeacherProfiles: TeacherListItem[] = [
  { id: 1, username: 'angel.cruz', full_name: 'Angel Cruz', department: 1, department_name: 'BSIT' },
  { id: 2, username: 'maria.santos', full_name: 'Maria Santos', department: 1, department_name: 'BSIT' },
  { id: 3, username: 'robert.reyes', full_name: 'Robert Reyes', department: 1, department_name: 'BSIT' },
  { id: 4, username: 'elena.garcia', full_name: 'Elena Garcia', department: null, department_name: '' },
];

export const registrarCourseComponents: CourseComponent[] = [
  {
    id: 1,
    course: registrarCourses[0], // COSC 7
    room_type: registrarRoomTypes[0], // lecture
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 2,
    course: registrarCourses[0], // COSC 7
    room_type: registrarRoomTypes[1], // laboratory
    label: 'laboratory',
    duration: 4,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 3,
    course: registrarCourses[1], // DCIT 5
    room_type: registrarRoomTypes[0], // lecture
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 4,
    course: registrarCourses[1], // DCIT 5
    room_type: registrarRoomTypes[1], // laboratory
    label: 'laboratory',
    duration: 4,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 5,
    course: registrarCourses[2], // MATH 10
    room_type: registrarRoomTypes[0], // lecture
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 6,
    course: registrarCourses[3], // GNED 12
    room_type: registrarRoomTypes[0], // lecture
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 7,
    course: registrarCourses[4], // PHYS 3
    room_type: registrarRoomTypes[0], // lecture
    label: 'lecture',
    duration: 2,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  {
    id: 8,
    course: registrarCourses[4], // PHYS 3
    room_type: registrarRoomTypes[1], // laboratory
    label: 'laboratory',
    duration: 4,
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
  },
];

export const registrarCourseAssignments: CourseAssignmentDetail[] = [
  {
    id: 1,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [
      { id: 1, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 },
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
      { id: 2, order: 2, mode: 'lab', mode_display: 'Laboratory', duration_slots: 4 },
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
      { id: 3, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 },
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
      { id: 4, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 },
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
      { id: 5, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 },
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
      { id: 6, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 },
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
      { id: 7, order: 2, mode: 'lab', mode_display: 'Laboratory', duration_slots: 4 },
    ],
    prof_name: 'Robert Reyes',
    subject_label: 'PHYS 3',
    section_name: '2-B',
  },
];

export const registrarSchedules: Schedule[] = [
  {
    id: 1,
    run: 1,
    assignment: 1,
    assignment_label: 'COSC 7 - 3-A',
    prof_id: 1,
    prof_name: 'Angel Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7',
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
    assignment_label: 'COSC 7 - 3-A Lab',
    prof_id: 1,
    prof_name: 'Angel Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7',
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
  {
    id: 3,
    run: 1,
    assignment: 3,
    assignment_label: 'DCIT 5 - 2-B',
    prof_id: 1,
    prof_name: 'Angel Cruz',
    section_id: 2,
    section_name: '2-B',
    subject_label: 'DCIT 5',
    room: 102,
    room_name: 'Room 204',
    day: 1,
    day_display: 'Tuesday',
    start_time: '10:00',
    end_time: '12:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
  {
    id: 4,
    run: 1,
    assignment: 4,
    assignment_label: 'MATH 10 - 3-A',
    prof_id: 2,
    prof_name: 'Maria Santos',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'MATH 10',
    room: 101,
    room_name: 'Room 101',
    day: 3,
    day_display: 'Thursday',
    start_time: '07:00',
    end_time: '09:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
  {
    id: 5,
    run: 1,
    assignment: 5,
    assignment_label: 'GNED 12 - 1-C',
    prof_id: 2,
    prof_name: 'Maria Santos',
    section_id: 3,
    section_name: '1-C',
    subject_label: 'GNED 12',
    room: 104,
    room_name: 'Room 305',
    day: 4,
    day_display: 'Friday',
    start_time: '10:00',
    end_time: '12:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
];

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const TIME_SLOTS = [
  { id: 1, label: '7:00 AM - 10:00 AM', start_time: '07:00' },
  { id: 2, label: '10:00 AM - 1:00 PM', start_time: '10:00' },
  { id: 3, label: '1:00 PM - 3:00 PM', start_time: '13:00' },
  { id: 4, label: '3:00 PM - 6:00 PM', start_time: '15:00' },
];

// Helper to get unscheduled assignments
export const getUnscheduledAssignments = () =>
  registrarCourseAssignments.filter(
    (a) => !registrarSchedules.some((s) => s.assignment === a.id)
  );

// Helper to get teacher's assignments
export const getTeacherAssignments = (teacherId: number) =>
  registrarCourseAssignments.filter((a) => a.prof === teacherId);

// Helper to get teacher's schedules
export const getTeacherSchedules = (teacherId: number) =>
  registrarSchedules.filter((s) => s.prof_id === teacherId);
