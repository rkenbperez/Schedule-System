import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduleCreatePayload } from '../types/Types';
import { scheduleService } from '../services/Schedule.service';

export function useSchedules(opts?: { teacherId?: number }) {
  const teacherId = opts?.teacherId;

  return useQuery({
    queryKey: [`schedules`, teacherId],
    queryFn: () => scheduleService.getSchedules(teacherId),
    enabled: teacherId ? true : false,
  });
}

export function useCourseAssignments(opts?: {
  teacherId?: number;
  enabled?: boolean;
}) {
  const teacherId = opts?.teacherId;

  return useQuery({
    queryKey: [`course-assignments`, teacherId],
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
    queryKey: [`course-components`, courseId],
    queryFn: () => scheduleService.getCourseComponents(courseId),
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ScheduleCreatePayload) =>
      scheduleService.createSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
