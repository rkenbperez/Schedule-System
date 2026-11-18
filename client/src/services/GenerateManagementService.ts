// pages/registrar/services/GenerateManagementService.ts
import type {
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  Schedule,
  ScheduledClass,
} from '../types/Types';
import { apiFetch, apiJson } from './http';

class GenerateManagementService {
  async generateSchedule(
    payload: GenerateSchedulePayload
  ): Promise<GenerateScheduleResponse> {
    const response = await apiFetch(`${BASE_URL()}/api/schedules/generate`, {
      method: 'POST',
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
    const data: ScheduledClass[] = await apiJson(
      `${BASE_URL()}/api/schedules/runs/${runId}/classes/`
    );

    return data;
  }

  async publishRun(runId: number): Promise<Schedule> {
    const response = await apiFetch(
      `${BASE_URL()}/api/admin/schedules/runs/${runId}/publish/`,
      {
        method: 'PATCH',
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

function BASE_URL() {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
}

export const generateManagementService = new GenerateManagementService();
