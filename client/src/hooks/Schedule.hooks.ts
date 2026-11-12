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
  courseId?: number;
  enabled?: boolean;
}) {
  const courseId = opts?.courseId;

  return useQuery({
    queryKey: ['course-components', courseId],
    queryFn: () => scheduleService.getCourseComponents(courseId),
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
  typeId?: number;
  enabled?: boolean;
}) {
  const typeId = opts?.typeId;

  return useQuery({
    queryKey: ['rooms', typeId],
    queryFn: () => scheduleService.getRooms(typeId),
    enabled: opts?.enabled ?? true,
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
