import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduleCreatePayload } from '../types/Types';
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
    queryFn: () => scheduleService.getCourseAssignments(teacherId),
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

export function useTeachers(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: () => scheduleService.getTeachers(),
    enabled: opts?.enabled ?? true,
  });
}

export function useAllAssignments(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['all-assignments'],
    queryFn: () => scheduleService.getAllAssignments(),
    enabled: opts?.enabled ?? true,
  });
}

export function useAllSchedules(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['all-schedules'],
    queryFn: () => scheduleService.getAllSchedules(),
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

export function useImportCommit() {
  return useMutation({
    mutationFn: (previewToken: string) =>
      scheduleService.importCommit(previewToken),
  });
}

export function useCreateRegistrarSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ScheduleCreatePayload) =>
      scheduleService.createSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ScheduleCreatePayload) =>
      scheduleService.createSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] });
    },
  });
}
