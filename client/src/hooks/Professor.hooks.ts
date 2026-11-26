import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleService } from '../services/Schedule.service';
import type {
  MeetingPreference,
  GenerateFromPublishedPayload,
  GenerateFromPublishedResponse,
} from '../types/Types';

export function useProfessorPreferences(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['professor-preferences'],
    queryFn: () => scheduleService.getProfessorPreferences(),
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateProfessorPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      subject: number;
      section: number;
      meetings: MeetingPreference[];
    }) => scheduleService.createProfessorPreference(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function useUpdateProfessorPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        subject: number;
        section: number;
        meetings: MeetingPreference[];
      }>;
    }) => scheduleService.updateProfessorPreference(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function useDeleteProfessorPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteProfessorPreference(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function useSubmitProfessorPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.submitProfessorPreference(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function useProfessorAvailability(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['professor-availability'],
    queryFn: () => scheduleService.getProfessorAvailability(),
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateProfessorAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      day: number;
      start_time: string;
      end_time: string;
      is_preferred?: boolean;
    }) => scheduleService.createProfessorAvailability(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-availability'] });
    },
  });
}

export function useUpdateProfessorAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        day: number;
        start_time: string;
        end_time: string;
        is_preferred: boolean;
      }>;
    }) => scheduleService.updateProfessorAvailability(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-availability'] });
    },
  });
}

export function useDeleteProfessorAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scheduleService.deleteProfessorAvailability(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professor-availability'] });
    },
  });
}

export function useDepartmentHeadSubmissions(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['department-head-submissions'],
    queryFn: () => scheduleService.getDepartmentHeadSubmissions(),
    enabled: opts?.enabled ?? true,
  });
}

export function usePublishPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: number;
      action: 'publish' | 'reject';
      notes?: string;
    }) => scheduleService.publishPreference(id, action, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department-head-submissions'] });
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function useBatchPublishPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      preferenceIds,
      action,
      notes,
    }: {
      preferenceIds: number[];
      action: 'publish' | 'reject';
      notes?: string;
    }) => scheduleService.batchPublishPreferences(preferenceIds, action, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['department-head-submissions'] });
      qc.invalidateQueries({ queryKey: ['professor-preferences'] });
    },
  });
}

export function usePublishedPreferences(termId?: number, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['published-preferences', termId],
    queryFn: () => scheduleService.getPublishedPreferences(termId),
    enabled: opts?.enabled ?? true,
  });
}

export function useGenerateFromPublished() {
  return useMutation<
    GenerateFromPublishedResponse,
    Error,
    GenerateFromPublishedPayload
  >({
    mutationFn: (payload) => scheduleService.generateFromPublished(payload),
  });
}