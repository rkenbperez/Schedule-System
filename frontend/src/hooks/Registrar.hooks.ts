import { useQuery } from '@tanstack/react-query';
import { registrarService } from '../services/Registrar.service';

export const registrarKeys = {
  all: ['registrar'] as const,
  teachers: ['registrar', 'teachers'] as const,
  teacher: (id: number) => ['registrar', 'teacher', id] as const,
};

export function useTeacherList() {
  return useQuery({
    queryKey: registrarKeys.teachers,
    queryFn: () => registrarService.getTeacherList(),
  });
}

export function useTeacher(id: number) {
  return useQuery({
    queryKey: registrarKeys.teacher(id),
    queryFn: () => registrarService.getTeacher({ id }),
    enabled: !!id,
  });
}
