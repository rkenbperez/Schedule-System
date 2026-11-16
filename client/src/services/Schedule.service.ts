import type {
  AcademicTerm,
  Course,
  CourseAssignmentDetail,
  CourseComponent,
  CreateAssignmentPayload,
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ImportPreviewResponse,
  ProfessorProfile,
  Room,
  RoomType,
  Schedule,
  ScheduleCreatePayload,
  Section,
  TeacherListItem,
} from '../types/Types';

export type StudentScheduleParams = {
  section: string;
  term?: string;
};

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

class ScheduleService {
  async getSchedules(teacherId?: number) {
    const query = teacherId ? `?prof=${teacherId}` : '';

    const response = await fetch(`${BASE_URL}/api/schedules/my${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load schedules');
    }

    const data: Schedule[] = await response.json();

    return data;
  }

  async getCourseAssignments(teacherId?: number) {
    const query = teacherId ? `?prof_id=${teacherId}` : '';

    const response = await fetch(`${BASE_URL}/api/assignments/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load course assignments');
    }

    const data: CourseAssignmentDetail[] = await response.json();

    return data;
  }

  async getCourseComponents(): Promise<CourseComponent[]> {
    // Backend does not have a standalone course-components endpoint yet.
    // Return empty array; component data is embedded in schedule class responses.
    return [];
  }

  async getTerms() {
    const response = await fetch(`${BASE_URL}/api/academics/terms/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load terms');
    }

    const data: AcademicTerm[] = await response.json();

    return data;
  }

  async getCourses() {
    const response = await fetch(`${BASE_URL}/api/subjects/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load courses');
    }

    const data: Course[] = await response.json();

    return data;
  }

  async getSections(termId?: number) {
    const query = termId ? `?term=${termId}` : '';

    const response = await fetch(`${BASE_URL}/api/sections/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load sections');
    }

    const data: Section[] = await response.json();

    return data;
  }

  async getRoomTypes() {
    const response = await fetch(`${BASE_URL}/api/rooms/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load room types');
    }

    const data: RoomType[] = await response.json();

    return data;
  }

  async getRooms(): Promise<Room[]> {
    const response = await fetch(`${BASE_URL}/api/rooms/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load rooms');
    }

    const data: Room[] = await response.json();

    return data;
  }

  async getRoomSchedule(roomId: number): Promise<Schedule[]> {
    // /api/schedules/runs/<run_id>/classes/ requires a run_id and the runs list
    // endpoint is registrar-only. Use /api/schedules/my instead, which returns
    // the teacher's scheduled classes from the latest active run, then filter
    // by room on the frontend.
    const response = await fetch(`${BASE_URL}/api/schedules/my`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load room schedule');
    }

    const data: Schedule[] = await response.json();

    return data.filter((s) => s.room === roomId);
  }

  async getStudentSchedule(params: StudentScheduleParams) {
    const queryParams = new URLSearchParams();
    if (params.section.trim()) queryParams.set('section', params.section.trim());
    if (params.term?.trim()) queryParams.set('term', params.term.trim());

    const response = await fetch(
      `${BASE_URL}/api/students/schedule/?${queryParams.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load student schedule');
    }

    const data: Schedule[] = await response.json();

    return data;
  }

  async getTeachers() {
    const response = await fetch(`${BASE_URL}/api/profs/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load teachers');
    }

    const data: TeacherListItem[] = await response.json();

    return data;
  }

  async getAllAssignments() {
    const response = await fetch(`${BASE_URL}/api/assignments/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load assignments');
    }

    const data: CourseAssignmentDetail[] = await response.json();

    return data;
  }

  async getAllSchedules() {
    const response = await fetch(`${BASE_URL}/api/schedules/runs`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load schedules');
    }

    const data: Schedule[] = await response.json();

    return data;
  }

  async getProfessorProfile(): Promise<ProfessorProfile> {
    const response = await fetch(`${BASE_URL}/api/professor/me/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load professor profile');
    }

    const data: ProfessorProfile = await response.json();
    return data;
  }

  async getProfessorSchedule(runId?: number): Promise<Schedule[]> {
    const query = runId ? `?run_id=${runId}` : '';

    const response = await fetch(`${BASE_URL}/api/professor/me/schedule/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load professor schedule');
    }

    const data: Schedule[] = await response.json();

    return data;
  }

  async createSchedule(payload: ScheduleCreatePayload) {
    const response = await fetch(`${BASE_URL}/api/schedules/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to create schedule');
    }

    const data: Schedule = await response.json();

    return data;
  }

  async createAssignment(payload: CreateAssignmentPayload) {
    const response = await fetch(`${BASE_URL}/api/assignments/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to create course assignment');
    }

    const data: CourseAssignmentDetail = await response.json();

    return data;
  }

  async importPreview(file: File): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/api/imports/preview/`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Unable to preview import file');
    }

    const data: ImportPreviewResponse = await response.json();

    return data;
  }

  async importCommit(previewToken: string): Promise<{
    committed: boolean;
    summary: { creates: number; updates: number };
    errors?: Array<{ sheet: string; row: number; field: string; message: string }>;
  }> {
    const response = await fetch(`${BASE_URL}/api/imports/commit/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preview_token: previewToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Unable to commit import');
    }

    const data = await response.json();
    return data;
  }

  async generateSchedule(payload: GenerateSchedulePayload): Promise<GenerateScheduleResponse> {
    const response = await fetch(`${BASE_URL}/api/schedules/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to generate schedule');
    }

    const data: GenerateScheduleResponse = await response.json();

    return data;
  }
}

export const scheduleService = new ScheduleService();
