import { apiGet, apiPost, setAccessToken } from './client';
import type { CurrentUser, LoginCredentials, LoginResponse } from '../../types';

interface AuthMeResponseRaw {
  staff_id: number;
  username: string;
  role: CurrentUser['role'];
  branch_id: number;
}

function mapAuthMeResponse(raw: AuthMeResponseRaw): CurrentUser {
  return {
    staffId: raw.staff_id,
    firstName: '',
    lastName: '',
    role: raw.role,
    branchId: raw.branch_id,
    branchName: '',
  };
}

/** POST /auth/login - stores the returned access token in memory. */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const result = await apiPost<LoginResponse>('/auth/login', credentials);
  setAccessToken(result.access_token);
  return result;
}

/** POST /auth/logout - invalidates the session server-side, clears the local token either way. */
export async function logout(): Promise<void> {
  try {
    await apiPost<null>('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

/** GET /auth/me - full profile for the currently authenticated session. */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const raw = await apiGet<AuthMeResponseRaw>('/auth/me');
  return mapAuthMeResponse(raw);
}
