import { apiDelete, apiGet, apiPost } from './client';
import { fetchDoctorOptions } from './doctorOptions';
import type { DoctorOption } from './doctorOptions';
import { asArray } from './mappers';
import type { Doctor, Specialty } from '../../types';

export interface DoctorListParams {
  branchId?: number;
  specialtyId?: number;
}

interface DoctorRaw extends Omit<Doctor, 'specialties' | 'consultationFee'> {
  consultationFee: number | string;
  specialties?: unknown;
}

function toDoctor(raw: DoctorRaw): Doctor {
  return {
    ...raw,
    consultationFee: Number(raw.consultationFee),
    specialties: asArray<Specialty>(raw.specialties),
  };
}

export async function fetchDoctors(params?: DoctorListParams): Promise<DoctorOption[]> {
  return fetchDoctorOptions(params);
}

export async function fetchDoctorByStaffId(staffId: number): Promise<Doctor> {
  const raw = await apiGet<DoctorRaw>(`/staff/${staffId}/doctor`);
  return toDoctor(raw);
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
  const raw = await apiPost<DoctorRaw>(`/staff/${staffId}/doctor`, input);
  return toDoctor(raw);
}

export async function linkDoctorSpecialty(
  staffId: number,
  specialtyId: number,
): Promise<{ staffId: number; specialtyId: number }> {
  return apiPost<{ staffId: number; specialtyId: number }>(`/staff/${staffId}/doctor/specialties`, {
    specialtyId,
  });
}

export async function unlinkDoctorSpecialty(staffId: number, specialtyId: number): Promise<void> {
  await apiDelete<void>(`/staff/${staffId}/doctor/specialties/${specialtyId}`);
}

