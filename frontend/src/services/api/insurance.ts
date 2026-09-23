import { apiGet, apiPatch, apiPost } from './client';
import type { InsurancePolicy } from '../../types';

export async function fetchPatientInsurance(patientId: number): Promise<InsurancePolicy[]> {
  return apiGet<InsurancePolicy[]>(`/patients/${patientId}/insurance`);
}

export async function addPatientInsurance(
  patientId: number,
  input: {
    policyId: string;
    providerName: string;
    coverageLevel: string;
    status?: 'Active' | 'Inactive';
  },
): Promise<InsurancePolicy> {
  return apiPost<InsurancePolicy>(`/patients/${patientId}/insurance`, input);
}

export async function updatePatientInsurance(
  patientId: number,
  policyId: string,
  updates: Partial<Omit<InsurancePolicy, 'policyId' | 'patientId'>>,
): Promise<InsurancePolicy> {
  return apiPatch<InsurancePolicy>(`/patients/${patientId}/insurance/${policyId}`, updates);
}
