import { apiGet } from './client';
import type { PagedResult } from '../../types';

export interface RoleOption {
  roleId?: number;
  roleName: string;
}

export async function fetchRoles(page = 1, pageSize = 25): Promise<PagedResult<RoleOption>> {
  return apiGet<PagedResult<RoleOption>>('/roles', { page, pageSize });
}
