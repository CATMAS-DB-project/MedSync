import { apiFetch, setAccessToken } from './client';
import type { CurrentUser, LoginCredentials, LoginResponse } from '../../types';

interface AuthMeResponseRaw {
  staff_id: number;
  first_name: string;
  last_name: string;
  role: CurrentUser['role'];
  branch_id: number;
  branch_name: string;
}

function mapAuthMeResponse(raw: AuthMeResponseRaw): CurrentUser {
  return {
    staffId: raw.staff_id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    role: raw.role,
    branchId: raw.branch_id,
    branchName: raw.branch_name,
  };
}

/** POST /auth/login - stores the returned access token in memory. */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
  setAccessToken(result.accessToken);
  return result;
}

/** POST /auth/logout - invalidates the session server-side, clears the local token either way. */
export async function logout(): Promise<void> {
  try {
    await apiFetch<null>('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

/** GET /auth/me - full profile for the currently authenticated session. */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const raw = await apiFetch<AuthMeResponseRaw>('/auth/me');
  return mapAuthMeResponse(raw);
}
