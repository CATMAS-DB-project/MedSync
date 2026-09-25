import { apiGet, apiPatch, apiPost } from './client';
import type { Guardian, PagedResult } from '../../types';

export interface GuardianListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchGuardians(params?: GuardianListParams): Promise<PagedResult<Guardian>> {
  const queryParams: Record<string, unknown> = {};

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    });
  }

  return apiGet<PagedResult<Guardian>>('/guardians', queryParams);
}

export async function fetchGuardianById(guardianId: number): Promise<Guardian> {
  return apiGet<Guardian>(`/guardians/${guardianId}`);
}

export async function createGuardian(input: {
  firstName: string;
  lastName: string;
  nic?: string;
  address?: string;
}): Promise<Guardian> {
  return apiPost<Guardian>('/guardians', input);
}

export async function updateGuardian(
  guardianId: number,
  updates: Partial<Omit<Guardian, 'guardianId' | 'createdAt'>>,
): Promise<Guardian> {
  return apiPatch<Guardian>(`/guardians/${guardianId}`, updates);
}
