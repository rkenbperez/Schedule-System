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
