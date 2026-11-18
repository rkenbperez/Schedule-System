// client/src/services/Schedule.service.ts
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
import { apiAllPages, apiBlob, apiFetch, apiJson } from './http';

export type StudentScheduleParams = {
  section: string;
  term?: string;
};

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

class ScheduleService {
  async getSchedules(teacherId?: number) {
    const query = teacherId ? `?prof=${teacherId}` : '';

    const data: Schedule[] = await apiJson(
      `${BASE_URL}/api/schedules/my${query}`
    );

    return data;
  }

  async getCourseAssignments(teacherId?: number) {
    const query = teacherId ? `?prof_id=${teacherId}` : '';

    // /api/assignments/ is paginated ({count, next, results}); fetch all pages.
    const data: CourseAssignmentDetail[] = await apiAllPages(
      `${BASE_URL}/api/assignments/${query}`
    );

    return data;
  }

  async getCourseComponents(): Promise<CourseComponent[]> {
    // Backend does not have a standalone course-components endpoint yet.
    // Return empty array; component data is embedded in schedule class responses.
    return [];
  }

  async getTerms() {
    const data: AcademicTerm[] = await apiJson(
      `${BASE_URL}/api/academics/terms/`
    );

    return data;
  }

  async getCourses() {
    // /api/subjects/ is paginated; fetch all pages.
    const data: Course[] = await apiAllPages(`${BASE_URL}/api/subjects/`);

    return data;
  }

  async getSections(termId?: number) {
    const query = termId ? `?term=${termId}` : '';

    // /api/sections/ is paginated; fetch all pages.
    const data: Section[] = await apiAllPages(
      `${BASE_URL}/api/sections/${query}`
    );

    return data;
  }

  async getRoomTypes() {
    // /api/rooms/ is paginated; fetch all pages.
    const data: RoomType[] = await apiAllPages(`${BASE_URL}/api/rooms/`);

    return data;
  }

  async getRooms(): Promise<Room[]> {
    // /api/rooms/ is paginated; fetch all pages.
    const data: Room[] = await apiAllPages(`${BASE_URL}/api/rooms/`);

    return data;
  }

  async getRoomSchedule(roomId: number): Promise<Schedule[]> {
    // /api/schedules/my returns the scheduled classes of the active run
    // (registrar sees all classes). Filter by room on the frontend.
    const data: Schedule[] = await apiJson(`${BASE_URL}/api/schedules/my`);

    return data.filter((s) => s.room === roomId);
  }

  async getStudentSchedule(params: StudentScheduleParams) {
    const queryParams = new URLSearchParams();
    if (params.section.trim()) queryParams.set('section', params.section.trim());
    if (params.term?.trim()) queryParams.set('term', params.term.trim());

    const data: Schedule[] = await apiJson(
      `${BASE_URL}/api/students/schedule/?${queryParams.toString()}`
    );

    return data;
  }

  async getTeachers() {
    // /api/profs/ is paginated; fetch all pages.
    const data: TeacherListItem[] = await apiAllPages(`${BASE_URL}/api/profs/`);

    return data;
  }

  async getAllAssignments() {
    // /api/assignments/ is paginated; fetch all pages.
    const data: CourseAssignmentDetail[] = await apiAllPages(
      `${BASE_URL}/api/assignments/`
    );

    return data;
  }

  async getAllSchedules() {
    // Return the scheduled classes of the active-term run (registrar sees all
    // classes). This is what the dashboard needs: each item has an `assignment`
    // id so scheduled-vs-pending can be computed correctly.
    // /api/schedules/my is not paginated and returns ScheduledClass[].
    const data: Schedule[] = await apiJson(`${BASE_URL}/api/schedules/my`);

    return data;
  }

  async getProfessorProfile(): Promise<ProfessorProfile> {
    const data: ProfessorProfile = await apiJson(
      `${BASE_URL}/api/professor/me/`
    );
    return data;
  }

  async getProfessorSchedule(runId?: number): Promise<Schedule[]> {
    const query = runId ? `?run_id=${runId}` : '';

    const data: Schedule[] = await apiJson(
      `${BASE_URL}/api/professor/me/schedule/${query}`
    );

    return data;
  }

  async createSchedule(payload: ScheduleCreatePayload) {
    const data: Schedule = await apiJson(`${BASE_URL}/api/schedules/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return data;
  }

  async createAssignment(payload: CreateAssignmentPayload) {
    const data: CourseAssignmentDetail = await apiJson(
      `${BASE_URL}/api/assignments/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    return data;
  }

  async importPreview(file: File): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiFetch(`${BASE_URL}/api/imports/preview/`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type for FormData; the browser sets the boundary.
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
    const data = await apiJson<{
      committed: boolean;
      summary: { creates: number; updates: number };
      errors?: Array<{ sheet: string; row: number; field: string; message: string }>;
    }>(`${BASE_URL}/api/imports/commit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preview_token: previewToken }),
    });

    return data;
  }

  async generateSchedule(payload: GenerateSchedulePayload): Promise<GenerateScheduleResponse> {
    const data: GenerateScheduleResponse = await apiJson(
      `${BASE_URL}/api/schedules/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    return data;
  }

  async updateScheduledClass(
    runId: number,
    classId: number,
    data: {
      room?: number | null;
      day?: number;
      start_time?: string;
      duration_slots?: number;
      mode?: string | null;
      prof_id?: number;
      subject_id?: number;
      section_id?: number;
    }
  ) {
    const result = await apiJson(
      `${BASE_URL}/api/schedules/runs/${runId}/classes/${classId}/update/`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    return result;
  }

  async deleteScheduledClass(runId: number, classId: number) {
    await apiFetch(
      `${BASE_URL}/api/schedules/runs/${runId}/classes/${classId}/delete/`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async clearScheduledClasses(runId: number) {
    await apiFetch(
      `${BASE_URL}/api/schedules/runs/${runId}/classes/clear/`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async exportSchedule(params: {
    runId: number;
    format: string;
  }): Promise<Blob> {
    return apiBlob(
      `${BASE_URL}/api/exports/schedules/${params.runId}.${params.format}`
    );
  }
}

export const scheduleService = new ScheduleService();
