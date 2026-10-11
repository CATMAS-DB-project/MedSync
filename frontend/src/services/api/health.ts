import axios from 'axios';

export const HEALTH_ENDPOINT = '/api/health';
export const HEALTH_TIMEOUT_MS = 8000;

export interface HealthResponse {
  status: string;
}

const healthClient = axios.create({
  timeout: HEALTH_TIMEOUT_MS,
  withCredentials: false,
});

export async function fetchSystemHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await healthClient.get<HealthResponse>(HEALTH_ENDPOINT, {
    signal,
  });
  return response.data;
}

