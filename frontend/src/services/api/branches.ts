import { apiGet, apiPatch, apiPost } from './client';
import type { Branch, PagedResult } from '../../types';

export async function fetchBranches(page = 1, pageSize = 25): Promise<PagedResult<Branch>> {
  return apiGet<PagedResult<Branch>>('/branches', { page, pageSize });
}

export async function fetchBranchById(branchId: number): Promise<Branch> {
  return apiGet<Branch>(`/branches/${branchId}`);
}

export async function createBranch(input: {
  branchName: string;
  address: string;
  contactNumber?: string;
  managerStaffId?: number;
}): Promise<Branch> {
  return apiPost<Branch>('/branches', input);
}

export async function updateBranch(
  branchId: number,
  updates: Partial<Omit<Branch, 'branchId'>>,
): Promise<Branch> {
  return apiPatch<Branch>(`/branches/${branchId}`, updates);
}
