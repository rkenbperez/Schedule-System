import type {
  CourseAssignmentDetail,
  CourseComponent,
  Schedule,
  ScheduleCreatePayload,
} from '../types/Types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

class ScheduleService {
  async getSchedules(teacherId?: number) {
    const query = teacherId ? `?teacher=${teacherId}` : '';

    const response = await fetch(`${BASE_URL}/api/scheduling/schedules/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load schedules');
    }

    const data: Schedule[] = await response.json();

    return data;
  }

  async getCourseAssignments(teacherId?: number) {
    const query = teacherId ? `?teacher=${teacherId}` : '';

    const response = await fetch(`${BASE_URL}/api/scheduling/assignments/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load course assignments');
    }

    const data: CourseAssignmentDetail[] = await response.json();

    return data;
  }

  async getCourseComponents(courseId?: number) {
    const query = courseId ? `?course=${courseId}` : '';

    const response = await fetch(
      `${BASE_URL}/api/academics/course-components/${query}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load course components');
    }

    const data: CourseComponent[] = await response.json();

    return data;
  }

  async createSchedule(payload: ScheduleCreatePayload) {
    const response = await fetch(`${BASE_URL}/api/scheduling/schedules/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to create schedule');
    }

    const data: Schedule = await response.json();

    return data;
  }
}

export const scheduleService = new ScheduleService();