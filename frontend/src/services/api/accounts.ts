import { apiPatch, apiPost } from './client';
import type { AccountStatus, Role, UserAccount } from '../../types';

interface UserAccountRaw {
  staffId: number;
  username: string;
  role?: Role;
  roleId?: number;
  roleName?: Role;
  accountStatus: AccountStatus;
  lastLogin?: string | null;
  createdAt?: string;
}

function toUserAccount(raw: UserAccountRaw): UserAccount {
  const role = (raw.roleName ?? raw.role) as Role;
  return {
    staffId: raw.staffId,
    username: raw.username,
    role,
    roleId: raw.roleId,
    roleName: raw.roleName ?? role,
    accountStatus: raw.accountStatus,
    lastLogin: raw.lastLogin ?? undefined,
    createdAt: raw.createdAt,
  };
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
  const raw = await apiPost<UserAccountRaw>(`/staff/${staffId}/account`, payload);
  return toUserAccount(raw);
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
  const raw = await apiPatch<UserAccountRaw>(`/staff/${staffId}/account`, payload);
  return toUserAccount(raw);
}

export async function resetStaffPassword(
  staffId: number,
  input: {
    newPassword: string;
  },
): Promise<void> {
  await apiPost<void>(`/staff/${staffId}/account/reset-password`, input);
}

