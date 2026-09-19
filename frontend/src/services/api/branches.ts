import { apiGet, apiPatch, apiPost } from './client';
import type { Branch } from '../../types';

export async function fetchBranches(): Promise<Branch[]> {
  return apiGet<Branch[]>('/branches');
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
