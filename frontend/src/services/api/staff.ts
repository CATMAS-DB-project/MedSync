import { apiGet, apiPatch, apiPost } from './client';
import { asArray } from './mappers';
import type { EmploymentStatus, PagedResult, Phone, Staff, StaffRecord } from '../../types';

export interface StaffListParams extends Record<string, unknown> {
  branchId?: number;
  jobTitle?: string;
  employmentStatus?: EmploymentStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface StaffRecordRaw extends Omit<StaffRecord, 'phones'> {
  phones?: unknown;
}

function toStaffRecord(raw: StaffRecordRaw): StaffRecord {
  return {
    ...raw,
    isDoctor: Boolean(raw.isDoctor),
    hasAccount: Boolean(raw.hasAccount),
    phones: asArray<Phone>(raw.phones),
  };
}

export async function fetchStaff(params?: StaffListParams): Promise<PagedResult<Staff>> {
  return apiGet<PagedResult<Staff>>('/staff', params);
}

export async function fetchStaffById(staffId: number): Promise<StaffRecord> {
  const raw = await apiGet<StaffRecordRaw>(`/staff/${staffId}`);
  return toStaffRecord(raw);
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
}): Promise<StaffRecord> {
  const raw = await apiPost<StaffRecordRaw>('/staff', input);
  return toStaffRecord(raw);
}

export async function updateStaff(
  staffId: number,
  updates: Partial<Omit<Staff, 'staffId'>>,
): Promise<StaffRecord> {
  const raw = await apiPatch<StaffRecordRaw>(`/staff/${staffId}`, updates);
  return toStaffRecord(raw);
}

