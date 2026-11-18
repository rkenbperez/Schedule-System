export type UserRole = 'admin' | 'teacher';

export interface TeacherProfile {
  id: number;
  user: { id: number; username: string; full_name: string; email: string };
  username: string;
  full_name: string;
  department: number | null;
  department_name: string;
  max_daily_hours: number;
  max_consecutive: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_staff: boolean;
  professor?: {
    id: number;
    department: string | null;
    max_daily_hours: number;
    max_consecutive: number;
  } | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface TimeSlot {
  id: number;
  label: string;
}

export interface AvailableSlot {
  day_of_week: number;
  day_label?: string;
  time_slot: TimeSlot;
  time_label?: string;
  available: boolean;
  reason?: string;
}

export interface AssignmentComponent {
  id: number;
  label: string;
  room_type: string;
  scheduled: boolean;
  schedule: {
    id: number;
    day_of_week: number;
    time_slot: string;
    room: string;
  } | null;
}

export interface AssignmentComponents {
  assignment_id: number;
  course: { code: string; title: string };
  section: { code: string; student_count: number };
  components: AssignmentComponent[];
}

export interface CourseAssignment {
  id: number;
  course: { id: number; code: string; title: string };
  section: {
    id: number;
    code: string;
    program: string | null;
    year_level: number | null;
    student_count: number;
    academic_term: number;
  };
  type: string;
  scheduled: boolean;
}

export interface ScheduledCourse {
  id: number;

  course: {
    id: number;
    code: string;
    title: string;
  };

  section: {
    id: number;
    code: string;
    program: string | null;
    year_level: number | null;
    student_count: number;
    academic_term: number;
  };

  type: string;

  room: {
    id: number;
    code: string;
  };

  day_of_week: number;

  start_time: string;
  end_time: string | null;
}

export interface RoomType {
  id: number;
  name: string;
}

export interface Room {
  id: number;
  name: string;
  capacity: number;
  department: number | null;
  department_name: string;
  building: string;
}

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  name: string;
  headcount: number;
  program: string | null;
  year_level: number | null;
  term: number | null;
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
  prof: number;
  subject: number;
  section: number;
  term: number;
  meetings: Array<{ id: number; order: number; mode: string; mode_display: string; duration_slots: number }>;
  prof_name: string;
  subject_label: string;
  section_name: string;
}

export interface Schedule {
  id: number;
  run: number;
  assignment: number;
  assignment_label: string;
  prof_id: number;
  prof_name: string;
  subject_id: number;
  section_id: number;
  section_name: string;
  subject_label: string;
  room: number | null;
  room_name: string | null;
  day: number;
  day_display: string;
  start_time: string;
  end_time: string | null;
  duration_slots: number;
  mode: string | null;
  mode_display: string | null;
  term: number | null;
}

export interface TeacherListItem {
  id: number;
  username: string;
  full_name: string;
  department: number | null;
  department_name: string;
}

export interface RegistrarSchedulePayload {
  course_assignment: number;
  course_component: number;
  room: number;
  start_time: string;
  day_of_week: number;
}

export interface ScheduleCreatePayload {
  course_assignment: number;
  course_component: number;
  room: number;
  start_time: string;
  day_of_week: number;
}

export interface ImportRecord {
  id: number;
  course_code: string;
  course_title: string;
  section_code: string;
  program: string | null;
  year_level: number | null;
  student_count: number;
  teacher_employee_no: string;
  teacher_full_name: string | null;
  term_name: string;
  term_school_year: string;
  component_type: 'lecture' | 'laboratory';
  is_valid: boolean;
  error_message: string | null;
}

export interface ImportPreviewResponse {
  preview_token: string;
  records?: ImportRecord[];
  errors: string[];
  warnings?: string[];
  created_count?: number;
  updated_count?: number;
}

export interface ImportCommitResponse {
  committed: boolean;
  summary: { creates: number; updates: number };
  errors?: Array<{ sheet: string; row: number; field: string; message: string }>;
}

export interface GenerateSchedulePayload {
  algorithm: 'greedy' | 'min_conflicts' | 'backtracking';
  time_limit_s?: number;
}

export interface GenerateScheduleResponse {
  run_id: number;
  algorithm: string;
  status: 'feasible' | 'infeasible';
  feasible: boolean;
  runtime_ms: number;
  soft_score: number;
  class_count: number;
  violations: string[];
  unplaced: string[];
}

export interface ScheduledClass {
  id: number;
  course_code: string;
  course_title: string;
  teacher_name: string;
  section_code: string;
  room: number;
  room_code: string;
  room_name: string;
  day: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  duration_slots: number;
}

export interface CreateAssignmentPayload {
  academic_term: number;
  teacher: number;
  course: number;
  section: number;
  type: 'lecture' | 'laboratory';
}

export interface ProfessorAssignment {
  id: number;
  subject: { id: number; code: string; title: string; units: string };
  section: {
    id: number;
    name: string;
    headcount: number;
    program: string | null;
    year_level: number | null;
  };
  term: { id: number; code: string; name: string } | null;
  meetings: Array<{ id: number; order: number; mode: string; mode_display: string; duration_slots: number }>;
}

export interface ProfessorProfile {
  id: number;
  user: { id: number; username: string; full_name: string; email: string };
  department: { id: number; name: string } | null;
  max_daily_hours: number;
  max_consecutive: number;
  active_term: { id: number; code: string; name: string } | null;
  assignments: ProfessorAssignment[];
}
