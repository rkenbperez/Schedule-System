// mocks/mockAssignments.ts

import type { CourseAssignment } from './types/Types';
import type { ScheduledCourse } from './types/Types';

export const mockAssignments: CourseAssignment[] = [
  {
    id: 1,
    course: {
      id: '10',
      code: 'COSC 7',
      name: 'Data Structures and Algorithms',
    },
    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 2026 - 2027,
      student_count: 30,
    },
    type: 'lecture',
    scheduled: true,
  },

  {
    id: 2,
    course: {
      id: '10',
      code: 'COSC 7',
      name: 'Data Structures and Algorithms',
    },
    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 2026 - 2027,
      student_count: 30,
    },
    type: 'laboratory',
    scheduled: false,
  },

  {
    id: 3,
    course: {
      id: '11',
      code: 'DCIT 5',
      name: 'Database Management Systems',
    },
    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 2026 - 2027,
      student_count: 28,
    },
    type: 'lecture',
    scheduled: true,
  },

  {
    id: 4,
    course: {
      id: '11',
      code: 'DCIT 5',
      name: 'Database Management Systems',
    },
    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 2026 - 2027,
      student_count: 28,
    },
    type: 'laboratory',
    scheduled: true,
  },

  {
    id: 5,
    course: {
      id: '12',
      code: 'GNED 12',
      name: 'Ethics',
    },
    section: {
      id: '7',
      name: '1-C',
      year_leve: 1,
      academic_term: 2026 - 2027,
      student_count: 40,
    },
    type: 'lecture',
    scheduled: true,
  },

  {
    id: 6,
    course: {
      id: '13',
      code: 'MATH 10',
      name: 'Calculus II',
    },
    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 2026 - 2027,
      student_count: 30,
    },
    type: 'lecture',
    scheduled: false,
  },

  {
    id: 7,
    course: {
      id: '14',
      code: 'PHYS 3',
      name: 'General Physics',
    },
    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 2026 - 2027,
      student_count: 28,
    },
    type: 'lecture',
    scheduled: true,
  },

  {
    id: 8,
    course: {
      id: '14',
      code: 'PHYS 3',
      name: 'General Physics',
    },
    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 2026 - 2027,
      student_count: 28,
    },
    type: 'laboratory',
    scheduled: false,
  },

  {
    id: 9,
    course: {
      id: '15',
      code: 'CHEM 4',
      name: 'General Chemistry',
    },
    section: {
      id: '7',
      name: '1-C',
      year_leve: 1,
      academic_term: 2026 - 2027,
      student_count: 40,
    },
    type: 'lecture',
    scheduled: false,
  },

  {
    id: 10,
    course: {
      id: '15',
      code: 'CHEM 4',
      name: 'General Chemistry',
    },
    section: {
      id: '7',
      name: '1-C',
      year_leve: 1,
      academic_term: 2026 - 2027,
      student_count: 40,
    },
    type: 'laboratory',
    scheduled: false,
  },

  {
    id: 11,
    course: {
      id: '16',
      code: 'PE 1',
      name: 'Physical Education',
    },
    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 2026 - 2027,
      student_count: 30,
    },
    type: 'lecture',
    scheduled: true,
  },
];

export const mockSchedules: ScheduledCourse[] = [
  {
    id: 1,

    course: {
      id: '10',
      code: 'COSC 7',
      name: 'Data Structures and Algorithms',
    },

    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 1,
      student_count: 30,
    },

    type: 'lecture',

    room: {
      id: '101',
      name: 'Room 101',
    },

    day_of_week: 0,
    time_slot_label: '7:00 AM - 10:00 AM',
  },

  {
    id: 2,

    course: {
      id: '11',
      code: 'DCIT 5',
      name: 'Database Management Systems',
    },

    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 1,
      student_count: 28,
    },

    type: 'lecture',

    room: {
      id: '204',
      name: 'Room 204',
    },

    day_of_week: 1,
    time_slot_label: '1:00 PM - 3:00 PM',
  },

  {
    id: 3,

    course: {
      id: '11',
      code: 'DCIT 5',
      name: 'Database Management Systems',
    },

    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 1,
      student_count: 28,
    },

    type: 'laboratory',

    room: {
      id: '202',
      name: 'Lab 202',
    },

    day_of_week: 3,
    time_slot_label: '1:00 PM - 3:00 PM',
  },

  {
    id: 4,

    course: {
      id: '12',
      code: 'GNED 12',
      name: 'Ethics',
    },

    section: {
      id: '7',
      name: '1-C',
      year_leve: 1,
      academic_term: 1,
      student_count: 40,
    },

    type: 'lecture',

    room: {
      id: '305',
      name: 'Room 305',
    },

    day_of_week: 1,
    time_slot_label: '1:00 PM - 3:00 PM',
  },

  {
    id: 5,

    course: {
      id: '14',
      code: 'PHYS 3',
      name: 'General Physics',
    },

    section: {
      id: '6',
      name: '2-B',
      year_leve: 2,
      academic_term: 1,
      student_count: 28,
    },

    type: 'lecture',

    room: {
      id: '108',
      name: 'Room 108',
    },

    day_of_week: 4,
    time_slot_label: '7:00 AM - 10:00 AM',
  },

  {
    id: 6,

    course: {
      id: '16',
      code: 'PE 1',
      name: 'Physical Education',
    },

    section: {
      id: '5',
      name: '3-A',
      year_leve: 3,
      academic_term: 1,
      student_count: 30,
    },

    type: 'lecture',

    room: {
      id: 'G1',
      name: 'Gym 1',
    },

    day_of_week: 2,
    time_slot_label: '3:00 PM - 6:00 PM',
  },
];
