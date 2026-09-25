import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../../constants/api';
import { ApiError } from './ApiError';
import type { ApiEnvelope, RefreshResponse } from '../../types';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

const refreshClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

export async function refreshAccessToken(): Promise<string> {
  try {
    const response = await refreshClient.post<ApiEnvelope<RefreshResponse>>('/auth/refresh');
    const envelope = response.data;
    if (envelope.error || !envelope.data) {
      throw new ApiError(envelope.error?.message ?? 'Session expired', 'SESSION_EXPIRED', response.status);
    }
    accessToken = envelope.data.accessToken;
    return accessToken;
  } catch {
    throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiEnvelope<unknown>;
    if (envelope && envelope.error) {
      throw new ApiError(envelope.error.message, envelope.error.code, response.status);
    }
    response.data = envelope ? envelope.data : response.data;
    return response;
  },
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._isRetry) {
      try {
        await refreshAccessToken();
      } catch {
        accessToken = null;
        onSessionExpired?.();
        throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
      }
      originalRequest._isRetry = true;
      return apiClient(originalRequest);
    }

    const envelope = error.response?.data;
    const message = envelope?.error?.message ?? error.message ?? 'Request failed';
    const code = envelope?.error?.code ?? 'UNKNOWN_ERROR';
    throw new ApiError(message, code, error.response?.status ?? 0);
  },
);

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get<T>(path, { params });
  return response.data;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiClient.post<T>(path, body);
  return response.data;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiClient.patch<T>(path, body);
  return response.data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await apiClient.delete<T>(path);
  return response.data;
}
