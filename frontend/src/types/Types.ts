export type UserRole = 'admin' | 'teacher';

export interface TeacherProfile {
  id: number;
  user: number;
  username: string;
  employee_no?: string;
  full_name: string;
  department: number;
  department_name: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  teacher_profile?: TeacherProfile | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  username: string;
  role: UserRole;
  employee_no?: string;
  full_name?: string;
}

export interface TimeSlot {
  id: number;
  label: string;
}

export interface AvailableSlot {
  day_of_week: number;
  time_slot: TimeSlot;
  available: boolean;
}

export interface CourseAssignment {
  id: number;
  course: { id: string; code: string; name: string };
  section: {
    id: string;
    name: string;
    year_leve: number;
    academic_term: number;
    student_count: number;
  };
  type: string;
  scheduled: boolean;
}

export interface ScheduledCourse {
  id: number;

  course: {
    id: string;
    code: string;
    name: string;
  };

  section: {
    id: string;
    name: string;
    year_leve: number;
    academic_term: number;
    student_count: number;
  };

  type: string;

  room: {
    id: string;
    name: string;
  };

  day_of_week: number;

  time_slot_label: string;
}

export interface RoomType {
  id: number;
  name: string;
}

export interface Room {
  id: number;
  room_type: RoomType;
  code: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface AcademicTerm {
  id: number;
  name: string;
  school_year: string;
  term_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  units: string;
  is_active: boolean;
  created_at: string;
}

export interface Section {
  id: number;
  code: string;
  program: string | null;
  year_level: number | null;
  student_count: number;
  academic_term: AcademicTerm;
  is_active: boolean;
  created_at: string;
}

export interface CourseComponent {
  id: number;
  course: Course;
  room_type: RoomType;
  label: string;
  duration: number;
  is_active: boolean;
  created_at: string;
}

export interface CourseAssignmentDetail {
  id: number;
  academic_term: AcademicTerm;
  teacher: TeacherProfile;
  course: Course;
  section: Section;
  type: string;
  is_active: boolean;
  created_at: string;
}

export interface Schedule {
  id: number;
  course_assignment: CourseAssignmentDetail;
  course_component: CourseComponent;
  academic_term: AcademicTerm;
  teacher: TeacherProfile;
  section: Section;
  room: Room;
  start_time: string;
  end_time: string | null;
  day_of_week: number;
  is_active: boolean;
  created_at: string;
}

export interface ScheduleCreatePayload {
  course_assignment: number;
  course_component: number;
  room: number;
  start_time: string;
  day_of_week: number;
}
