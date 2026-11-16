// pages/registrar/services/GenerateManagementService.ts
import type {
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  Schedule,
  ScheduledClass,
} from '../types/Types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

class GenerateManagementService {
  async generateSchedule(
    payload: GenerateSchedulePayload
  ): Promise<GenerateScheduleResponse> {
    const response = await fetch(`${BASE_URL}/api/schedules/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to generate schedule');
    }

    const data: GenerateScheduleResponse = await response.json();

    return data;
  }

  async getRunClasses(runId: number): Promise<ScheduledClass[]> {
    const response = await fetch(
      `${BASE_URL}/api/schedules/runs/${runId}/classes/`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Unable to fetch generated classes');
    }

    const data: ScheduledClass[] = await response.json();

    return data;
  }

  async publishRun(runId: number): Promise<Schedule> {
    const response = await fetch(
      `${BASE_URL}/api/admin/schedules/runs/${runId}/publish/`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: true }),
      }
    );

    if (!response.ok) {
      throw new Error('Unable to publish schedule');
    }

    return await response.json();
  }
}

export const generateManagementService = new GenerateManagementService();
