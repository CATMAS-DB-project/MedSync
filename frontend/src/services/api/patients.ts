import { apiGet, apiPatch, apiPost } from './client';
import type { Gender, PagedResult, Patient } from '../../types';

export interface PatientListParams {
  search?: string;
  branchId?: number;
  page?: number;
  pageSize?: number;
}

export interface RegisterPatientInput {
  nicPassportNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
  registeredBranchId: number;
  phoneNumber?: string;
  phoneType?: 'Mobile' | 'Home' | 'Work';
}

export async function fetchPatients(params?: PatientListParams): Promise<PagedResult<Patient>> {
  const queryParams: Record<string, unknown> = {};

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    });
  }

  return apiGet<PagedResult<Patient>>('/patients', queryParams);
}

export async function fetchPatientById(patientId: number): Promise<Patient> {
  return apiGet<Patient>(`/patients/${patientId}`);
}

export async function registerPatient(input: RegisterPatientInput): Promise<Patient> {
  return apiPost<Patient>('/patients', input);
}

export async function updatePatient(
  patientId: number,
  updates: Partial<Omit<Patient, 'patientId' | 'createdAt' | 'registeredBranchName'>>,
): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${patientId}`, updates);
}
