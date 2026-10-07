import { apiGet, apiPost, setAccessToken } from './client';
import type { AuthUser, CurrentUser, LoginCredentials, LoginResponse, Staff } from '../../types';

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const result = await apiPost<LoginResponse>('/auth/login', credentials);
  setAccessToken(result.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiPost<null>('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const me = await apiGet<AuthUser>('/auth/me');

  let firstName = '';
  let lastName = '';
  let branchName = '';
  try {
    const staff = await apiGet<Pick<Staff, 'firstName' | 'lastName' | 'branchName'>>(
      `/staff/${me.staffId}`,
    );
    firstName = staff.firstName;
    lastName = staff.lastName;
    branchName = staff.branchName ?? '';
  } catch {

  }

  return {
    staffId: me.staffId,
    username: me.username,
    firstName,
    lastName,
    role: me.role,
    branchId: me.branchId,
    branchName,
  };
}
