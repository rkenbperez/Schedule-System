import type {
  AcademicTerm,
  Course,
  CourseAssignmentDetail,
  CourseComponent,
  Room,
  RoomType,
  Schedule,
  ScheduleCreatePayload,
  Section,
} from '../types/Types';

export type StudentScheduleParams = {
  section: string;
  term?: string;
};

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

class ScheduleService {
  async getSchedules(teacherId?: number) {
    const query = teacherId ? `?teacherId=${teacherId}` : '';

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
    const query = teacherId ? `?teacherId=${teacherId}` : '';

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

  async getTerms() {
    const response = await fetch(`${BASE_URL}/api/academics/terms/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load terms');
    }

    const data: AcademicTerm[] = await response.json();

    return data;
  }

  async getCourses() {
    const response = await fetch(`${BASE_URL}/api/academics/courses/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load courses');
    }

    const data: Course[] = await response.json();

    return data;
  }

  async getSections(termId?: number) {
    const query = termId ? `?term=${termId}` : '';

    const response = await fetch(`${BASE_URL}/api/academics/sections/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load sections');
    }

    const data: Section[] = await response.json();

    return data;
  }

  async getRoomTypes() {
    const response = await fetch(`${BASE_URL}/api/rooms/room-types/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load room types');
    }

    const data: RoomType[] = await response.json();

    return data;
  }

  async getRooms(typeId?: number) {
    const query = typeId ? `?type=${typeId}` : '';

    const response = await fetch(`${BASE_URL}/api/rooms/rooms/${query}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to load rooms');
    }

    const data: Room[] = await response.json();

    return data;
  }

  async getStudentSchedule(params: StudentScheduleParams) {
    const queryParams = new URLSearchParams();
    if (params.section.trim()) queryParams.set('section', params.section.trim());
    if (params.term?.trim()) queryParams.set('term', params.term.trim());

    const response = await fetch(
      `${BASE_URL}/api/students/schedule/?${queryParams.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error('Unable to load student schedule');
    }

    const data: Schedule[] = await response.json();

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
