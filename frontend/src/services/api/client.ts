import { API_BASE_URL } from '../../constants/api';
import { ApiError } from './ApiError';
import type { ApiEnvelope } from '../../types';
import type { RefreshResponse } from '../../types';

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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Internal - prevents infinite refresh loops. Never set this yourself. */
  _isRetry?: boolean;
}

export async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError('Session expired', 'SESSION_EXPIRED', response.status);
  }

  const envelope: ApiEnvelope<RefreshResponse> = await response.json();
  if (envelope.error || !envelope.data) {
    throw new ApiError(envelope.error?.message ?? 'Session expired', 'SESSION_EXPIRED', 401);
  }

  accessToken = envelope.data.accessToken;
  return accessToken;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, _isRetry = false } = options;

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired mid-session - refresh once and retry the original
  // request. If refresh itself fails, the session is genuinely over.
  if (response.status === 401 && !_isRetry) {
    try {
      await refreshAccessToken();
    } catch {
      accessToken = null;
      onSessionExpired?.();
      throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
    }
    return apiFetch<T>(path, { ...options, _isRetry: true });
  }

  const envelope: ApiEnvelope<T> = await response.json();

  if (envelope.error) {
    throw new ApiError(envelope.error.message, envelope.error.code, response.status);
  }

  return envelope.data as T;
}
