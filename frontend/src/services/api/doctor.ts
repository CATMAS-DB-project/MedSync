import { apiDelete, apiGet, apiPost } from './client';
import type { Doctor, PagedResult, Specialty } from '../../types';

export interface DoctorListParams {
  branchId?: number;
  specialtyId?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchDoctors(params?: DoctorListParams): Promise<PagedResult<Doctor>> {
  const queryParams: Record<string, unknown> = {};

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    });
  }

  return apiGet<PagedResult<Doctor>>('/doctors', queryParams);
}

export async function fetchDoctorByStaffId(staffId: number): Promise<Doctor> {
  return apiGet<Doctor>(`/staff/${staffId}/doctor`);
}

export async function promoteStaffToDoctor(
  staffId: number,
  input: {
    licenseNo: string;
    yearsOfExperience: number;
    consultationFee: number;
    qualifications?: string;
  },
): Promise<Doctor> {
  return apiPost<Doctor>(`/staff/${staffId}/doctor`, input);
}

export async function linkDoctorSpecialty(staffId: number, specialtyId: number): Promise<Specialty> {
  return apiPost<Specialty>(`/staff/${staffId}/doctor/specialties`, { specialtyId });
}

export async function unlinkDoctorSpecialty(staffId: number, specialtyId: number): Promise<void> {
  await apiDelete<void>(`/staff/${staffId}/doctor/specialties/${specialtyId}`);
}
