// client/src/services/Schedule.service.ts
import type {
  AcademicTerm,
  AutoAssignResult,
  Course,
  CourseAssignmentDetail,
  CourseComponent,
  CreateAssignmentPayload,
  Department,
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  GenerateFromPublishedPayload,
  GenerateFromPublishedResponse,
  ImportBatch,
  ImportBatchRollbackResponse,
  ImportPreviewResponse,
  MeetingPreference,
  ProfessorPreference,
  ProfessorPreferenceListItem,
  ProfessorProfile,
  ProfessorSubject,
  PreferenceSubmission,
  Room,
  RoomType,
  Schedule,
  ScheduleCreatePayload,
  ScheduleRun,
  Section,
  SectionSubject,
  TeacherListItem,
  AvailabilityWindow,
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

  async getMyAssignments(): Promise<CourseAssignmentDetail[]> {
    const data: CourseAssignmentDetail[] = await apiJson(
      `${BASE_URL}/api/professor/me/assignments/`
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

  async getCourses(departmentId?: number) {
    // /api/subjects/ is paginated; fetch all pages. An optional departmentId
    // scopes the list to subjects qualified by that department's professors.
    const query = departmentId ? `?department=${departmentId}` : '';
    const data: Course[] = await apiAllPages(`${BASE_URL}/api/subjects/${query}`);

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

  async getTeachers(termId?: number, departmentId?: number) {
    // /api/profs/ is paginated; fetch all pages. An optional departmentId
    // scopes the list to that department's professors.
    const params = new URLSearchParams();
    if (termId) params.set('term', String(termId));
    if (departmentId) params.set('department', String(departmentId));
    const query = params.toString() ? `?${params.toString()}` : '';
    const data: TeacherListItem[] = await apiAllPages(`${BASE_URL}/api/profs/${query}`);

    return data;
  }

  async getUsers() {
    // /api/users/ returns all auth users (for professor user selection).
    const data: Array<{ id: number; username: string; email: string }> =
      await apiJson(`${BASE_URL}/api/users/`);

    return data;
  }

  async getDepartments(opts?: { headed?: 'me' }) {
    // /api/departments/ is paginated; fetch all pages.
    const query = opts?.headed ? `?headed=${opts.headed}` : '';
    const data: Department[] = await apiAllPages(
      `${BASE_URL}/api/departments/${query}`
    );

    return data;
  }

  async getAllAssignments(termId?: number) {
    // /api/assignments/ is paginated; fetch all pages.
    const query = termId ? `?term=${termId}` : '';
    const data: CourseAssignmentDetail[] = await apiAllPages(
      `${BASE_URL}/api/assignments/${query}`
    );

    return data;
  }

  async getAllSchedules(termId?: number) {
    // /api/schedules/my returns the scheduled classes of the active-term run
    // (registrar sees all classes). Filter by term via query param.
    const query = termId ? `?term=${termId}` : '';
    const data: Schedule[] = await apiJson(`${BASE_URL}/api/schedules/my${query}`);

    return data;
  }

  async getScheduleRuns(): Promise<ScheduleRun[]> {
    // /api/schedules/runs is paginated; fetch all pages.
    const data: ScheduleRun[] = await apiAllPages(
      `${BASE_URL}/api/schedules/runs`
    );

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

  async createSchedule(
    runIdOrPayload: number | ScheduleCreatePayload,
    payload?: ScheduleCreatePayload
  ): Promise<Schedule> {
    if (typeof runIdOrPayload === 'number') {
      if (!payload) throw new Error('Schedule payload is required');

      const data: Schedule = await apiJson(
        `${BASE_URL}/api/schedules/runs/${runIdOrPayload}/classes/`,
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

    const data: Schedule = await apiJson(
      `${BASE_URL}/api/schedules/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runIdOrPayload),
      }
    );
    return data;
  }

  async createAssignment(payload: CreateAssignmentPayload) {
    // Map frontend-facing field names to the backend Assignment serializer:
    // { prof, subject, section, term, meetings: [{ mode, duration_slots }] }.
    // Every assignment must include at least one sync/lab meeting.
    const durationByMode = { sync: 2, lab: 3, async: 1 };
    const backendPayload = {
      prof: payload.teacher,
      subject: payload.course,
      section: payload.section,
      term: payload.academic_term,
      meetings: [
        {
          order: 1,
          mode: payload.type,
          duration_slots: durationByMode[payload.type],
        },
      ],
    };

    const data: CourseAssignmentDetail = await apiJson(
      `${BASE_URL}/api/assignments/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendPayload),
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

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.ok) {
      return body as ImportPreviewResponse;
    }

    // Validation failures return HTTP 400 together with the full preview so
    // the UI can show per-row errors. Keep that payload instead of replacing
    // it with a generic error.
    if (
      body !== null &&
      typeof body === 'object' &&
      'preview_items' in body &&
      'errors' in body
    ) {
      return body as ImportPreviewResponse;
    }

    let detail = `Unable to preview import file (HTTP ${response.status})`;
    if (body !== null && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.detail === 'string') {
        detail = record.detail;
      } else if (typeof record.error === 'string') {
        detail = record.error;
      }
    }

    throw new Error(detail);
  }

  async downloadImportTemplate(format: 'xlsx' | 'csv'): Promise<Blob> {
    return apiBlob(
      `${BASE_URL}/api/data-transfer/template/?format=${format}`
    );
  }

  async importCommit(
    previewToken: string,
    selectedKeys?: string[]
  ): Promise<{
    committed: boolean;
    summary: { creates: number; updates: number };
    batch_id?: number;
    errors?: Array<{ sheet: string; row: number; field: string; message: string }>;
  }> {
    const data = await apiJson<{
      committed: boolean;
      summary: { creates: number; updates: number };
      batch_id?: number;
      errors?: Array<{ sheet: string; row: number; field: string; message: string }>;
    }>(`${BASE_URL}/api/imports/commit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preview_token: previewToken,
        selected_keys: selectedKeys,
      }),
    });

    return data;
  }

  async getImportBatches(): Promise<ImportBatch[]> {
    const data: ImportBatch[] = await apiJson(
      `${BASE_URL}/api/imports/batches/`
    );
    return data;
  }

  async rollbackImportBatch(
    batchId: number
  ): Promise<ImportBatchRollbackResponse> {
    const data: ImportBatchRollbackResponse = await apiJson(
      `${BASE_URL}/api/imports/batches/${batchId}/rollback/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
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

  async getRunClasses(runId: number): Promise<Schedule[]> {
    return apiJson(`${BASE_URL}/api/schedules/runs/${runId}/classes/`);
  }

  async publishRun(runId: number): Promise<Schedule> {
    const response = await apiFetch(
      `${BASE_URL}/api/admin/schedules/runs/${runId}/publish/`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: true }),
      },
    );
    if (!response.ok) {
      throw new Error('Unable to publish schedule');
    }
    return response.json();
  }

  /* ---------- Master Data CRUD (Rooms) ---------- */

  async createRoom(payload: {
    name: string;
    capacity: number;
    department?: number | null;
    building?: string;
    room_type?: string;
  }) {
    return apiJson(`${BASE_URL}/api/rooms/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async updateRoom(id: number, payload: Partial<{
    name: string;
    capacity: number;
    department: number | null;
    building: string;
    room_type: string;
  }>) {
    return apiJson(`${BASE_URL}/api/rooms/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async deleteRoom(id: number) {
    await apiFetch(`${BASE_URL}/api/rooms/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Master Data CRUD (Subjects / Courses) ---------- */

  async createSubject(payload: {
    code: string;
    title: string;
    units: number;
    lec_hours?: number;
    lab_hours?: number;
  }) {
    return apiJson(`${BASE_URL}/api/subjects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async updateSubject(id: number, payload: Partial<{
    code: string;
    title: string;
    units: number;
    lec_hours: number;
    lab_hours: number;
  }>) {
    return apiJson(`${BASE_URL}/api/subjects/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async deleteSubject(id: number) {
    await apiFetch(`${BASE_URL}/api/subjects/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Master Data CRUD (Sections) ---------- */

  async createSection(payload: {
    name: string;
    headcount: number;
    program?: string | null;
    year_level?: number | null;
    term_id?: number | null;
  }) {
    return apiJson(`${BASE_URL}/api/sections/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async updateSection(id: number, payload: Partial<{
    name: string;
    headcount: number;
    program: string | null;
    year_level: number | null;
    term: number | null;
  }>) {
    return apiJson(`${BASE_URL}/api/sections/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async deleteSection(id: number) {
    await apiFetch(`${BASE_URL}/api/sections/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Master Data CRUD (Professors) ---------- */

  async createProfessor(payload: {
    user_email: string;
    user_password?: string;
    user_is_staff?: boolean;
    department_id?: number | null;
    max_daily_hours?: number;
    max_consecutive?: number;
    department_head?: boolean;
  }) {
    return apiJson(`${BASE_URL}/api/profs/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async updateProfessor(id: number, payload: Partial<{
    user_email: string;
    user_password?: string;
    user_is_staff?: boolean;
    department_id: number | null;
    max_daily_hours: number;
    max_consecutive: number;
    department_head: boolean;
  }>) {
    return apiJson(`${BASE_URL}/api/profs/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async deleteProfessor(id: number) {
    await apiFetch(`${BASE_URL}/api/profs/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async createProfessorSetupLink(id: number) {
    return apiJson<{ setup_url: string; expires_at: string }>(
      `${BASE_URL}/api/users/professors/${id}/setup-link/`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
  }

  /* ---------- Master Data CRUD (Departments) ---------- */

  async createDepartment(payload: { name: string; head?: number | null }) {
    const data: Department = await apiJson(`${BASE_URL}/api/departments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return data;
  }

  async updateDepartment(
    id: number,
    payload: Partial<{ name: string; head: number | null }>
  ) {
    const data: Department = await apiJson(
      `${BASE_URL}/api/departments/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async deleteDepartment(id: number) {
    await apiFetch(`${BASE_URL}/api/departments/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Department Chair (Professor Subjects) ---------- */

  async getProfessorSubjects(departmentId: number) {
    const data: ProfessorSubject[] = await apiJson(
      `${BASE_URL}/api/departments/${departmentId}/professor-subjects/`
    );
    return data;
  }

  async createProfessorSubject(
    departmentId: number,
    payload: {
      professor_id: number;
      subject_id: number;
      is_preferred?: boolean;
      modality?: 'synchronous' | 'asynchronous';
    }
  ) {
    const data: ProfessorSubject = await apiJson(
      `${BASE_URL}/api/departments/${departmentId}/professor-subjects/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async updateProfessorSubject(
    departmentId: number,
    assignmentId: number,
    payload: {
      modality?: 'synchronous' | 'asynchronous';
      is_preferred?: boolean;
    }
  ) {
    const data: ProfessorSubject = await apiJson(
      `${BASE_URL}/api/departments/${departmentId}/professor-subjects/${assignmentId}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async deleteProfessorSubject(departmentId: number, assignmentId: number) {
    await apiFetch(
      `${BASE_URL}/api/departments/${departmentId}/professor-subjects/${assignmentId}/`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /* ---------- Section Subject Requirements ---------- */

  async getSectionSubjects(sectionId?: number) {
    const query = sectionId ? `?section=${sectionId}` : '';
    const data: SectionSubject[] = await apiAllPages(
      `${BASE_URL}/api/section-subjects/${query}`
    );
    return data;
  }

  async createSectionSubject(payload: { section: number; subject: number }) {
    const data: SectionSubject = await apiJson(
      `${BASE_URL}/api/section-subjects/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async deleteSectionSubject(id: number) {
    await apiFetch(`${BASE_URL}/api/section-subjects/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Auto Assignment ---------- */

  async autoAssign(payload?: {
    term_id?: number | null;
    replace_auto?: boolean;
  }) {
    const data: AutoAssignResult = await apiJson(
      `${BASE_URL}/api/schedules/auto-assign/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      }
    );
    return data;
  }

  /* ---------- Public Schedule API (no auth required) ---------- */

  async getPublicTerms() {
    const data: Array<{
      id: number;
      code: string;
      name: string;
      year: number;
      semester: number;
      start_date: string;
      end_date: string;
      is_active: boolean;
    }> = await apiJson(`${BASE_URL}/api/public/schedules/`);

    return data;
  }

  async getPublicTermSchedule(termCode: string) {
    const data: {
      schedule_run: { id: number; algorithm: string; status: string; published: boolean };
      term: { id: number; code: string; name: string };
      schedule: Array<{
        id: number;
        day: number;
        day_name: string;
        start_time: string;
        end_time: string;
        duration_slots: number;
        subject: { code: string; title: string };
        section: { id: number; name: string; program: string | null; year_level: number | null };
        room: { id: number; name: string; building: string } | null;
        professor: { id: number; name: string; department: string | null };
        mode: string | null;
        mode_display: string | null;
        department_name: string | null;
      }>;
    } = await apiJson(`${BASE_URL}/api/public/schedules/${termCode}/`);

    return data;
  }

  async getPublicTermSections(termCode: string) {
    const data: {
      term: { id: number; code: string; name: string };
      sections: Array<{
        id: number;
        name: string;
        headcount: number;
        program: string | null;
        year_level: number | null;
        term: { id: number; code: string; name: string } | null;
      }>;
    } = await apiJson(`${BASE_URL}/api/public/schedules/${termCode}/sections/`);

    return data;
  }

  /* ---------- Professor Preferences ---------- */

  async getProfessorPreferences(): Promise<ProfessorPreference[]> {
    const data: ProfessorPreference[] = await apiAllPages(
      `${BASE_URL}/api/professor/preferences/`
    );
    return data;
  }

  async createProfessorPreference(payload: {
    subject: number;
    section: number;
    meetings: MeetingPreference[];
  }): Promise<ProfessorPreference> {
    const data: ProfessorPreference = await apiJson(
      `${BASE_URL}/api/professor/preferences/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async updateProfessorPreference(
    id: number,
    payload: Partial<{
      subject: number;
      section: number;
      meetings: MeetingPreference[];
    }>
  ): Promise<ProfessorPreference> {
    const data: ProfessorPreference = await apiJson(
      `${BASE_URL}/api/professor/preferences/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async deleteProfessorPreference(id: number): Promise<void> {
    await apiFetch(`${BASE_URL}/api/professor/preferences/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async submitProfessorPreference(id: number): Promise<ProfessorPreference> {
    const data: ProfessorPreference = await apiJson(
      `${BASE_URL}/api/professor/preferences/${id}/submit/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return data;
  }

  /* ---------- Professor Availability ---------- */

  async getProfessorAvailability(): Promise<AvailabilityWindow[]> {
    const data: AvailabilityWindow[] = await apiJson(
      `${BASE_URL}/api/professor/availability/`
    );
    return data;
  }

  async createProfessorAvailability(payload: {
    day: number;
    start_time: string;
    end_time: string;
    is_preferred?: boolean;
  }): Promise<AvailabilityWindow> {
    const data: AvailabilityWindow = await apiJson(
      `${BASE_URL}/api/professor/availability/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async updateProfessorAvailability(
    id: number,
    payload: Partial<{
      day: number;
      start_time: string;
      end_time: string;
      is_preferred: boolean;
    }>
  ): Promise<AvailabilityWindow> {
    const data: AvailabilityWindow = await apiJson(
      `${BASE_URL}/api/professor/availability/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }

  async deleteProfessorAvailability(id: number): Promise<void> {
    await apiFetch(`${BASE_URL}/api/professor/availability/${id}/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* ---------- Department Head ---------- */

  async getDepartmentHeadSubmissions(): Promise<PreferenceSubmission[]> {
    // The endpoint is a paginated DRF ViewSet ({count, next, results});
    // apiAllPages unwraps it and fetches every page.
    const data: PreferenceSubmission[] = await apiAllPages(
      `${BASE_URL}/api/department-head/submissions/`
    );
    return data;
  }

  async publishPreference(
    id: number,
    action: 'publish' | 'reject',
    notes?: string
  ): Promise<ProfessorPreference> {
    const data: ProfessorPreference = await apiJson(
      `${BASE_URL}/api/department-head/submissions/${id}/publish/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      }
    );
    return data;
  }

  async batchPublishPreferences(
    preferenceIds: number[],
    action: 'publish' | 'reject',
    notes?: string
  ): Promise<{ updated: number; preferences: ProfessorPreference[] }> {
    const data = await apiJson<{ updated: number; preferences: ProfessorPreference[] }>(
      `${BASE_URL}/api/department-head/submissions/batch-publish/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference_ids: preferenceIds, action, notes }),
      }
    );
    return data;
  }

  /* ---------- Registrar ---------- */

  async getPublishedPreferences(termId?: number): Promise<ProfessorPreferenceListItem[]> {
    const query = termId ? `?term=${termId}` : '';
    const data: ProfessorPreferenceListItem[] = await apiJson(
      `${BASE_URL}/api/registrar/published-preferences/${query}`
    );
    return data;
  }

  async generateFromPublished(
    payload: GenerateFromPublishedPayload
  ): Promise<GenerateFromPublishedResponse> {
    const data: GenerateFromPublishedResponse = await apiJson(
      `${BASE_URL}/api/schedules/generate-from-published`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return data;
  }
}

export const scheduleService = new ScheduleService();
