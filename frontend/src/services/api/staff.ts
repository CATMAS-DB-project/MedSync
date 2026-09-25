import { apiGet, apiPatch, apiPost } from './client';
import type { EmploymentStatus, PagedResult, Staff, StaffRecord } from '../../types';

export interface StaffListParams extends Record<string, unknown> {
  branchId?: number;
  jobTitle?: string;
  employmentStatus?: EmploymentStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchStaff(params?: StaffListParams): Promise<PagedResult<Staff>> {
  return apiGet<PagedResult<Staff>>('/staff', params);
}

export async function fetchStaffById(staffId: number): Promise<StaffRecord> {
  return apiGet<StaffRecord>(`/staff/${staffId}`);
}

export async function createStaff(input: {
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Staff['gender'];
  address?: string;
  branchId: number;
  jobTitle: string;
  employmentStatus?: EmploymentStatus;
  hireDate: string;
}): Promise<Staff> {
  return apiPost<Staff>('/staff', input);
}

export async function updateStaff(
  staffId: number,
  updates: Partial<Omit<Staff, 'staffId'>>,
): Promise<Staff> {
  return apiPatch<Staff>(`/staff/${staffId}`, updates);
}
