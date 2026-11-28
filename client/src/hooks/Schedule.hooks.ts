import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAssignmentPayload,
  Department,
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ScheduleCreatePayload,
} from '../types/Types';
import { scheduleService } from '../services/Schedule.service';

export function useSchedules(opts?: { teacherId?: number; enabled?: boolean }) {
  const teacherId = opts?.teacherId;

  return useQuery({
    queryKey: ['schedules', teacherId],
    queryFn: () => scheduleService.getSchedules(teacherId),
    enabled: opts?.enabled ?? true,
  });
}

export function useCourseAssignments(opts?: {
  teacherId?: number;
  enabled?: boolean;
}) {
  const teacherId = opts?.teacherId;

  return useQuery({
    queryKey: ['course-assignments', teacherId],
    queryFn: () => scheduleService.getMyAssignments(),
    enabled: opts?.enabled ?? true,
  });
}

export function useCourseComponents(opts?: {
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['course-components'],
    queryFn: () => scheduleService.getCourseComponents(),
    enabled: opts?.enabled ?? true,
  });
}

export function useTerms(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['terms'],
    queryFn: () => scheduleService.getTerms(),
    enabled: opts?.enabled ?? true,
  });
}

export function useCourses(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => scheduleService.getCourses(),
    enabled: opts?.enabled ?? true,
  });
}

export function useSections(opts?: {
  termId?: number;
  enabled?: boolean;
}) {
  const termId = opts?.termId;

  return useQuery({
    queryKey: ['sections', termId],
    queryFn: () => scheduleService.getSections(termId),
    enabled: opts?.enabled ?? true,
  });
}

export function useRoomTypes(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['room-types'],
    queryFn: () => scheduleService.getRoomTypes(),
    enabled: opts?.enabled ?? true,
  });
}

export function useRooms(opts?: {
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => scheduleService.getRooms(),
    enabled: opts?.enabled ?? true,
  });
}

export function useRoomSchedule(opts?: {
  roomId?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['room-schedule', opts?.roomId],
    queryFn: () => scheduleService.getRoomSchedule(opts!.roomId!),
    enabled: opts?.enabled ?? false,
  });
}

export function useStudentSchedule(
  section: string,
  term?: string,
  opts?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['student-schedule', section, term],
    queryFn: () => scheduleService.getStudentSchedule({ section, term }),
    enabled: opts?.enabled ?? !!section.trim(),
  });
}

export function useTeachers(opts?: {
  termId?: number | null;
  departmentId?: number;
  enabled?: boolean;
}) {
  const termId = opts?.termId ?? undefined;
  const departmentId = opts?.departmentId;

  return useQuery({
    queryKey: ['teachers', termId, departmentId],
    queryFn: () => scheduleService.getTeachers(termId, departmentId),
    enabled: opts?.enabled ?? true,
  });
}

export function useProfessorsByDepartment(opts?: {
  departmentId?: number;
  enabled?: boolean;
}) {
  const departmentId = opts?.departmentId;

  return useQuery({
    queryKey: ['professors-by-department', departmentId],
    queryFn: () => scheduleService.getTeachers(undefined, departmentId),
    enabled: opts?.enabled ?? Boolean(departmentId),
  });
}

export function useSubjectsByDepartment(opts?: {
  departmentId?: number;
  enabled?: boolean;
}) {
  const departmentId = opts?.departmentId;

  return useQuery({
    queryKey: ['subjects-by-department', departmentId],
    queryFn: () => scheduleService.getCourses(departmentId),
    enabled: opts?.enabled ?? Boolean(departmentId),
  });
}

export function useAllAssignments(opts?: { termId?: number | null; enabled?: boolean }) {
  const termId = opts?.termId ?? undefined;

  return useQuery({
    queryKey: ['all-assignments', termId],
    queryFn: () => scheduleService.getAllAssignments(termId),
    enabled: opts?.enabled ?? true,
  });
}

export function useAllSchedules(opts?: { termId?: number | null; enabled?: boolean }) {
  const termId = opts?.termId ?? undefined;

  return useQuery({
    queryKey: ['all-schedules', termId],
    queryFn: () => scheduleService.getAllSchedules(termId),
    enabled: opts?.enabled ?? true,
  });
}

export function useScheduleRuns(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['schedule-runs'],
    queryFn: () => scheduleService.getScheduleRuns(),
    enabled: opts?.enabled ?? true,
  });
}

export function useProfessorProfile(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['professor-profile'],
    queryFn: () => scheduleService.getProfessorProfile(),
    enabled: opts?.enabled ?? true,
  });
}

export function useProfessorSchedule(opts?: {
  runId?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['professor-schedule', opts?.runId],
    queryFn: () => scheduleService.getProfessorSchedule(opts?.runId),
    enabled: opts?.enabled ?? true,
  });
}

export function useUsers(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => scheduleService.getUsers(),
    enabled: opts?.enabled ?? true,
  });
}

export function useDepartments(opts?: {
  headed?: 'me';
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['departments', opts?.headed],
    queryFn: () => scheduleService.getDepartments({ headed: opts?.headed }),
    enabled: opts?.enabled ?? true,
  });
}

export function useImportCommit() {
  return useMutation({
    mutationFn: ({
      previewToken,
      selectedKeys,
    }: {
      previewToken: string;
      selectedKeys?: string[];
    }) => scheduleService.importCommit(previewToken, selectedKeys),
  });
}

export function useCreateRegistrarSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      payload,
    }: {
      runId: number;
      payload: ScheduleCreatePayload;
    }) => scheduleService.createSchedule(runId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-runs'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      payload,
    }: {
      runId: number;
      payload: ScheduleCreatePayload;
    }) => scheduleService.createSchedule(runId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
  });
}

/* ---------- Registrar hooks (moved from Registrar.hooks.ts and GenerateManagement.hooks.ts) ---------- */

export function useCourseAssignmentsByTeacher(opts?: {
  teacherId?: number;
  enabled?: boolean;
}) {
  const teacherId = opts?.teacherId;

  return useQuery({
    queryKey: ['registrar-course-assignments', teacherId],
    queryFn: () => scheduleService.getCourseAssignments(teacherId),
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAssignmentPayload) =>
      scheduleService.createAssignment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
  });
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (file: File) => scheduleService.importPreview(file),
  });
}

export function useImportBatches(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['import-batches'],
    queryFn: () => scheduleService.getImportBatches(),
    enabled: opts?.enabled ?? true,
  });
}

export function useRollbackImportBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (batchId: number) =>
      scheduleService.rollbackImportBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useImportTemplate() {
  return useMutation({
    mutationFn: (format: 'xlsx' | 'csv') =>
      scheduleService.downloadImportTemplate(format),
  });
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateSchedulePayload) =>
      scheduleService.generateSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-assignments'] });
    },
  });
}

export function useRunClasses() {
  return useMutation({
    mutationFn: (runId: number) =>
      scheduleService.getRunClasses(runId),
  });
}

export function usePublishRun() {
  return useMutation({
    mutationFn: (runId: number) =>
      scheduleService.publishRun(runId),
  });
}

export function useUpdateScheduledClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      classId,
      data,
    }: {
      runId: number;
      classId: number;
      data: {
        room?: number | null;
        day?: number;
        start_time?: string;
        duration_slots?: number;
        mode?: string | null;
        prof_id?: number;
        subject_id?: number;
        section_id?: number;
      };
    }) =>
      scheduleService.updateScheduledClass(runId, classId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteScheduledClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      classId,
    }: {
      runId: number;
      classId: number;
    }) => scheduleService.deleteScheduledClass(runId, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/* ---------- Master Data CRUD hooks ---------- */

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      capacity: number;
      department?: number | null;
      building?: string;
      room_type?: string;
    }) => scheduleService.createRoom(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: number;
      payload: Partial<{
        name: string;
        capacity: number;
        department: number | null;
        building: string;
        room_type: string;
      }>;
    }) => scheduleService.updateRoom(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      code: string;
      title: string;
      units: number;
      lec_hours?: number;
      lab_hours?: number;
    }) => scheduleService.createSubject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: number;
      payload: Partial<{
        code: string;
        title: string;
        units: number;
        lec_hours: number;
        lab_hours: number;
      }>;
    }) => scheduleService.updateSubject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      headcount: number;
      program?: string | null;
      year_level?: number | null;
      term_id?: number | null;
    }) => scheduleService.createSection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: number;
      payload: Partial<{
        name: string;
        headcount: number;
        program: string | null;
        year_level: number | null;
        term: number | null;
      }>;
    }) => scheduleService.updateSection(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });
}

export function useCreateProfessor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      user_email: string;
      user_password?: string;
      user_is_staff?: boolean;
      department_id?: number | null;
      max_daily_hours?: number;
      max_consecutive?: number;
      department_head?: boolean;
    }) => scheduleService.createProfessor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateProfessor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: number;
      payload: Partial<{
        user_email: string;
        user_password?: string;
        user_is_staff?: boolean;
        department_id: number | null;
        max_daily_hours: number;
        max_consecutive: number;
        department_head: boolean;
      }>;
    }) => scheduleService.updateProfessor(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteProfessor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteProfessor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; head?: number | null }) =>
      scheduleService.createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{ name: string; head: number | null }>;
    }) => scheduleService.updateDepartment(id, payload),
    onSuccess: (updated) => {
      // Apply the PATCH response immediately so head/head_name/head_email do
      // not wait on the refetch.
      queryClient.setQueryData<Department[]>(
        ['departments', undefined],
        (departments) =>
          departments?.map((department) =>
            department.id === updated.id ? updated : department
          )
      );
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useProfessorSubjects(departmentId?: number) {
  return useQuery({
    queryKey: ['professor-subjects', departmentId],
    queryFn: () => scheduleService.getProfessorSubjects(departmentId as number),
    enabled: Boolean(departmentId),
  });
}

export function useCreateProfessorSubject(departmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      professor_id: number;
      subject_id: number;
      is_preferred?: boolean;
      modality?: 'synchronous' | 'asynchronous';
    }) => scheduleService.createProfessorSubject(departmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['professor-subjects', departmentId],
      });
      // The department-scoped subject list is derived from qualifications.
      queryClient.invalidateQueries({ queryKey: ['subjects-by-department'] });
    },
  });
}

export function useUpdateProfessorSubject(departmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: number;
      payload: {
        modality?: 'synchronous' | 'asynchronous';
        is_preferred?: boolean;
      };
    }) =>
      scheduleService.updateProfessorSubject(
        departmentId,
        assignmentId,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['professor-subjects', departmentId],
      });
    },
  });
}

export function useDeleteProfessorSubject(departmentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) =>
      scheduleService.deleteProfessorSubject(departmentId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['professor-subjects', departmentId],
      });
      // The department-scoped subject list is derived from qualifications.
      queryClient.invalidateQueries({ queryKey: ['subjects-by-department'] });
    },
  });
}

export function useSectionSubjects(sectionId?: number) {
  return useQuery({
    queryKey: ['section-subjects', sectionId],
    queryFn: () => scheduleService.getSectionSubjects(sectionId),
    enabled: Boolean(sectionId),
  });
}

export function useCreateSectionSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { section: number; subject: number }) =>
      scheduleService.createSectionSubject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-subjects'] });
    },
  });
}

export function useDeleteSectionSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteSectionSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-subjects'] });
    },
  });
}

export function useAutoAssign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: {
      term_id?: number | null;
      replace_auto?: boolean;
    }) => scheduleService.autoAssign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-runs'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
    },
  });
}

export function useClearScheduledClasses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: number) =>
      scheduleService.clearScheduledClasses(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useExportSchedule() {
  return useMutation({
    mutationFn: (params: {
      runId: number;
      format: string;
    }) => scheduleService.exportSchedule(params),
  });
}

/* ---------- Algorithm comparison hooks ---------- */

export function useCompareAlgorithms() {
  const generateSchedule = useGenerateSchedule();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      timeLimitS,
      termId,
    }: {
      timeLimitS?: number;
      termId?: number;
    }) => {
      const algorithms: GenerateSchedulePayload['algorithm'][] = [
        'greedy',
        'min_conflicts',
        'backtracking',
      ];
      const results: GenerateScheduleResponse[] = [];

      for (const algorithm of algorithms) {
        const result = await generateSchedule.mutateAsync({
          algorithm,
          time_limit_s: timeLimitS,
          term_id: termId,
        });
        results.push(result);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-assignments'] });
    },
  });
}

/* ---------- Conflict resolution hooks ---------- */

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function useGetConflicts() {
  return useMutation({
    mutationFn: async (runId: number) => {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/schedules/runs/${runId}/conflicts/`,
      );
      if (!response.ok) throw new Error('Failed to fetch conflicts');
      return response.json();
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conflictId,
      resolutionType,
      resolutionDetails,
    }: {
      conflictId: number;
      resolutionType: string;
      resolutionDetails?: Record<string, unknown>;
    }) => {
      const response = await fetch(
        `/api/admin/conflict-resolutions/${conflictId}/resolve/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolution_type: resolutionType,
            resolution_details: resolutionDetails,
          }),
        },
      );
      if (!response.ok) throw new Error('Failed to resolve conflict');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
    },
  });
}

export function useIgnoreConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conflictId: number) => {
      const response = await fetch(
        `/api/admin/conflict-resolutions/${conflictId}/ignore/`,
        {
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('Failed to ignore conflict');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
    },
  });
}

/* ---------- Public Schedule Hooks (no auth required) ---------- */

export function usePublicTerms(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['public-terms'],
    queryFn: () => scheduleService.getPublicTerms(),
    enabled: opts?.enabled ?? true,
  });
}

export function usePublicTermSchedule(termCode: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['public-term-schedule', termCode],
    queryFn: () => scheduleService.getPublicTermSchedule(termCode),
    enabled: (opts?.enabled ?? true) && !!termCode,
  });
}

export function usePublicTermSections(termCode: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['public-term-sections', termCode],
    queryFn: () => scheduleService.getPublicTermSections(termCode),
    enabled: (opts?.enabled ?? true) && !!termCode,
  });
}
