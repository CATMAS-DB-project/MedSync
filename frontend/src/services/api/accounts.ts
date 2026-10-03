import { apiGet, apiPatch, apiPost } from './client';
import type { Role, UserAccount } from '../../types';

export async function fetchUserAccount(staffId: number): Promise<UserAccount> {
  return apiGet<UserAccount>(`/staff/${staffId}/account`);
}

export async function createUserAccount(
  staffId: number,
  input: {
    username: string;
    tempPassword: string;
    role: Role;
  },
): Promise<UserAccount> {
  const payload = {
    username: input.username,
    password: input.tempPassword, 
    roleName: input.role,
  };
  return apiPost<UserAccount>(`/staff/${staffId}/account`, payload);
}

export async function updateUserAccount(
  staffId: number,
  updates: Partial<Pick<UserAccount, 'role' | 'accountStatus'>>,
): Promise<UserAccount> {
  const payload: Record<string, unknown> = {};
  if ('role' in updates && updates.role !== undefined) {
    payload.roleName = updates.role;
  }
  if ('accountStatus' in updates && updates.accountStatus !== undefined) {
    payload.accountStatus = updates.accountStatus;
  }
  return apiPatch<UserAccount>(`/staff/${staffId}/account`, payload);
}

export async function resetStaffPassword(
  staffId: number,
  input?: {
    newPassword?: string;
  },
): Promise<void> {
  await apiPost<void>(`/staff/${staffId}/account/reset-password`, input ?? {});
}
