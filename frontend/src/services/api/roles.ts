import { apiGet } from './client';

export interface RoleOption {
  roleId?: string;
  roleName: string;
}

export async function fetchRoles(): Promise<RoleOption[]> {
  return apiGet<RoleOption[]>('/roles');
}
