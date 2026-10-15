import type { TeacherProfile } from '../types/Types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type getTeacherParams = Pick<
  TeacherProfile,
  | 'id'
  | ('department' & {
      max_daily_hours: number;
      max_consecutive: number;
    })
>;

class RegistrarService {
  async getTeacherList() {
    const response = await fetch(`${BASE_URL}/api/profs/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load teachers');
    }

    const json = await response.json();

    const data: TeacherProfile[] = Array.isArray(json)
      ? json
      : (json.results ?? []);

    return data;
  }

  async getTeacher(Tdata: getTeacherParams) {
    const response = await fetch(`${BASE_URL}/api/profs/${Tdata.id}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load teacher');
    }

    const data: TeacherProfile = await response.json();

    return data;
  }
}

export const registrarService = new RegistrarService();
