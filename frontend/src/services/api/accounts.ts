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
  return apiPost<UserAccount>(`/staff/${staffId}/account`, input);
}

export async function updateUserAccount(
  staffId: number,
  updates: Partial<Pick<UserAccount, 'role' | 'accountStatus'>>,
): Promise<UserAccount> {
  return apiPatch<UserAccount>(`/staff/${staffId}/account`, updates);
}

export async function resetStaffPassword(
  staffId: number,
  input?: {
    newPassword?: string;
  },
): Promise<void> {
  await apiPost<void>(`/staff/${staffId}/account/reset-password`, input ?? {});
}
