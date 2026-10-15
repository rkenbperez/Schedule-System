export interface Assignment {
  id: number;
  course_code: string;
  course_title: string;
  section_code: string;
  label: 'lecture' | 'laboratory';
  scheduled: boolean;
  day_of_week?: number | null;
  time_slot_label?: string | null;
  room?: string | null;
}

import type { TeacherProfile } from '../../types/Types';

export interface Teacher extends TeacherProfile {
  assignments: Assignment[];
}

export interface CourseOffering {
  id: number;
  course_code: string;
  course_title: string;
  section_code: string;
  label: 'lecture' | 'laboratory';
  department: string;
}

export const DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

export const availableOfferings: CourseOffering[] = [
  {
    id: 1,
    course_code: 'COSC 12',
    course_title: 'Operating Systems',
    section_code: '3-B',
    label: 'lecture',
    department: 'Computer Science',
  },
  {
    id: 2,
    course_code: 'COSC 12',
    course_title: 'Operating Systems',
    section_code: '3-B',
    label: 'laboratory',
    department: 'Computer Science',
  },
  {
    id: 3,
    course_code: 'COSC 20',
    course_title: 'Software Engineering',
    section_code: '4-A',
    label: 'lecture',
    department: 'Computer Science',
  },
  {
    id: 4,
    course_code: 'DCIT 20',
    course_title: 'Computer Networks',
    section_code: '2-A',
    label: 'lecture',
    department: 'Information Technology',
  },
  {
    id: 5,
    course_code: 'DCIT 20',
    course_title: 'Computer Networks',
    section_code: '2-A',
    label: 'laboratory',
    department: 'Information Technology',
  },
  {
    id: 6,
    course_code: 'DCIT 22',
    course_title: 'Web Systems and Technologies',
    section_code: '3-C',
    label: 'lecture',
    department: 'Information Technology',
  },
  {
    id: 7,
    course_code: 'PHYS 5',
    course_title: 'Modern Physics',
    section_code: '4-B',
    label: 'lecture',
    department: 'Physics',
  },
  {
    id: 8,
    course_code: 'PHYS 5',
    course_title: 'Modern Physics',
    section_code: '4-B',
    label: 'laboratory',
    department: 'Physics',
  },
  {
    id: 9,
    course_code: 'CHEM 8',
    course_title: 'Organic Chemistry',
    section_code: '2-C',
    label: 'lecture',
    department: 'Chemistry',
  },
  {
    id: 10,
    course_code: 'CHEM 8',
    course_title: 'Organic Chemistry',
    section_code: '2-C',
    label: 'laboratory',
    department: 'Chemistry',
  },
];

const juanAssignments: Assignment[] = Array.from(
  { length: 8 },
  (_, i): Assignment[] => [
    {
      id: i * 2 + 1,
      course_code: 'COSC 7',
      course_title: 'Data Structures and Algorithms',
      section_code: '3-A',
      label: 'lecture',
      scheduled: true,
      day_of_week: 0,
      time_slot_label: '7:00 AM - 10:00 AM',
      room: 'Room 101',
    },
    {
      id: i * 2 + 2,
      course_code: 'COSC 7',
      course_title: 'Data Structures and Algorithms',
      section_code: '3-A',
      label: 'laboratory',
      scheduled: false,
    },
  ]
).flat();

export const initialTeachers: Teacher[] = [
  {
    id: 1,
    user: 11,
    username: 'jdelacruz',
    employee_no: 'EMP-001',
    full_name: 'Juan Dela Cruz',
    department: 1,
    department_name: 'Computer Science',
    assignments: [
      ...juanAssignments,
      {
        id: 17,
        course_code: 'MATH 10',
        course_title: 'Calculus II',
        section_code: '3-A',
        label: 'lecture',
        scheduled: false,
      },
    ],
  },
  {
    id: 2,
    user: 12,
    username: 'msantos',
    employee_no: 'EMP-002',
    full_name: 'Maria Santos',
    department: 2,
    department_name: 'Information Technology',
    assignments: [
      {
        id: 18,
        course_code: 'DCIT 5',
        course_title: 'Database Management Systems',
        section_code: '2-B',
        label: 'lecture',
        scheduled: false,
      },
      {
        id: 19,
        course_code: 'DCIT 5',
        course_title: 'Database Management Systems',
        section_code: '2-B',
        label: 'laboratory',
        scheduled: false,
      },
      {
        id: 20,
        course_code: 'GNED 12',
        course_title: 'Ethics',
        section_code: '1-C',
        label: 'lecture',
        scheduled: true,
        day_of_week: 1,
        time_slot_label: '1:00 PM - 3:00 PM',
        room: 'Room 305',
      },
    ],
  },
  {
    id: 3,
    user: 13,
    username: 'preyes',
    employee_no: 'EMP-003',
    full_name: 'Pedro Reyes',
    department: 3,
    department_name: 'Physics',
    assignments: [
      {
        id: 21,
        course_code: 'PHYS 3',
        course_title: 'General Physics',
        section_code: '2-B',
        label: 'lecture',
        scheduled: false,
      },
      {
        id: 22,
        course_code: 'PHYS 3',
        course_title: 'General Physics',
        section_code: '2-B',
        label: 'laboratory',
        scheduled: false,
      },
    ],
  },
  {
    id: 4,
    user: 14,
    username: 'avillanueva',
    employee_no: 'EMP-004',
    full_name: 'Ana Villanueva',
    department: 4,
    department_name: 'Chemistry',
    assignments: [
      {
        id: 23,
        course_code: 'CHEM 4',
        course_title: 'General Chemistry',
        section_code: '1-C',
        label: 'lecture',
        scheduled: false,
      },
      {
        id: 24,
        course_code: 'CHEM 4',
        course_title: 'General Chemistry',
        section_code: '1-C',
        label: 'laboratory',
        scheduled: false,
      },
    ],
  },
];
