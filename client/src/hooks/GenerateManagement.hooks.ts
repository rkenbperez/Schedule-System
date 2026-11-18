import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAssignmentPayload,
  GenerateSchedulePayload,
  ScheduleCreatePayload,
} from '../types/Types';
import { scheduleService } from '../services/Schedule.service';
import { generateManagementService } from '../services/GenerateManagementService';

export function useTeachers(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['registrar-teachers'],
    queryFn: () => scheduleService.getTeachers(),
    enabled: opts?.enabled ?? true,
  });
}

export function useAllAssignments(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['registrar-all-assignments'],
    queryFn: () => scheduleService.getAllAssignments(),
    enabled: opts?.enabled ?? true,
  });
}

export function useAllSchedules(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['registrar-all-schedules'],
    queryFn: () => scheduleService.getAllSchedules(),
    enabled: opts?.enabled ?? true,
  });
}

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

export function useCreateRegistrarSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ScheduleCreatePayload) =>
      scheduleService.createSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrar-all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['registrar-all-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
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

export function useImportCommit() {
  return useMutation({
    mutationFn: (previewToken: string) =>
      scheduleService.importCommit(previewToken),
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
      generateManagementService.getRunClasses(runId),
  });
}

export function usePublishRun() {
  return useMutation({
    mutationFn: (runId: number) =>
      generateManagementService.publishRun(runId),
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
