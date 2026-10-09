import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../../constants/api';
import { ApiError } from './ApiError';
import type { ApiErrorDetails } from './ApiError';
import type { ApiEnvelope, RefreshResponse } from '../../types';
import {
  transformRequestPayload,
  transformResponsePayload,
  transformQueryParams,
} from './transformers';

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

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    'data' in body &&
    'error' in body
  );
}

function isAuthBootstrapUrl(url: string | undefined): boolean {
  return !!url && (url.includes('/auth/login') || url.includes('/auth/refresh'));
}

function toApiError(error: AxiosError<unknown>): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;

  if (isEnvelope(body) && body.error) {
    const { code, message, ...extras } = body.error;
    const details = transformResponsePayload(extras) as ApiErrorDetails;
    return new ApiError(message, code, status, details);
  }

  if (status === 0) {
    return new ApiError('Cannot reach the server. Check your connection.', 'NETWORK_ERROR', 0);
  }
  if (status === 502 || status === 503 || status === 504) {
    return new ApiError('The server is unavailable. Please try again shortly.', `http_${status}`, status);
  }
  return new ApiError(error.message || 'Request failed', `http_${status}`, status);
}

const refreshClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

async function requestNewAccessToken(): Promise<string> {
  try {
    const response = await refreshClient.post('/auth/refresh');
    const body = transformResponsePayload(response.data) as Partial<RefreshResponse> | undefined;
    if (!body?.accessToken) {
      throw new Error('Refresh response had no access token');
    }
    accessToken = body.accessToken;
    return accessToken;
  } catch {
    accessToken = null;
    throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
  }
}

let refreshInFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (config.data) {
    config.data = transformRequestPayload(config.data);
  }
  if (config.params) {
    config.params = transformQueryParams(config.params);
  }

  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => {
    const body: unknown = response.data;

    if (response.status === 204 || body === '' || body === undefined) {
      response.data = null;
      return response;
    }

    if (isEnvelope(body)) {
      if (body.error) {
        throw new ApiError(body.error.message, body.error.code, response.status);
      }
      response.data = transformResponsePayload(body.data);
      return response;
    }

    response.data = transformResponsePayload(body);
    return response;
  },
  async (error: AxiosError<unknown>) => {
    if (error instanceof ApiError) {
      throw error;
    }

    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._isRetry &&
      !isAuthBootstrapUrl(originalRequest.url)
    ) {
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

    throw toApiError(error);
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
