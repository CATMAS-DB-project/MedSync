import { apiGet, apiPatch, apiPost } from './client';
import { toPatient } from './mappers';
import type { PatientRaw } from './mappers';
import type { Gender, PagedResult, Patient } from '../../types';

export interface PatientListParams {
  /** Matches name, NIC/passport number or phone number, across all branches. */
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
}

export interface UpdatePatientInput {
  nicPassportNo?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string | null;
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
  if (typeof queryParams.search === 'string') {
    const trimmed = queryParams.search.trim();
    if (trimmed) {
      queryParams.search = trimmed;
    } else {
      delete queryParams.search;
    }
  }

  const result = await apiGet<PagedResult<PatientRaw>>('/patients', queryParams);
  return { ...result, items: result.items.map(toPatient) };
}

export async function fetchPatientById(patientId: number): Promise<Patient> {
  const raw = await apiGet<PatientRaw>(`/patients/${patientId}`);
  return toPatient(raw);
}

export async function registerPatient(input: RegisterPatientInput): Promise<Patient> {
  const raw = await apiPost<PatientRaw>('/patients', {
    ...input,
    address: input.address?.trim() || undefined,
  });
  return toPatient(raw);
}

export async function updatePatient(
  patientId: number,
  updates: UpdatePatientInput,
): Promise<Patient> {
  const raw = await apiPatch<PatientRaw>(`/patients/${patientId}`, updates);
  return toPatient(raw);
}
