import { apiGet, apiPatch, apiPost } from './client';
import { rethrowUniqueViolation } from './serviceErrors';
import type { InsurancePolicy, InsuranceStatus, PagedResult } from '../../types';

export interface AddInsuranceInput {
  policyId: string;
  providerName: string;
  coverageLevel: string;
  status?: InsuranceStatus;
}

export interface UpdateInsuranceInput {
  status?: InsuranceStatus;
  coverageLevel?: string;
}

export async function fetchPatientInsurance(patientId: number): Promise<InsurancePolicy[]> {
  const result = await apiGet<PagedResult<InsurancePolicy>>(`/patients/${patientId}/insurance`, {
    pageSize: 100,
  });
  return result.items;
}

export async function addPatientInsurance(
  patientId: number,
  input: AddInsuranceInput,
): Promise<InsurancePolicy> {
  try {
    return await apiPost<InsurancePolicy>(`/patients/${patientId}/insurance`, {
      policyId: input.policyId.trim(),
      providerName: input.providerName.trim(),
      coverageLevel: input.coverageLevel.trim(),
      status: input.status,
    });
  } catch (error) {
    rethrowUniqueViolation(error, 'This insurance policy ID is already registered.');
  }
}

export async function updatePatientInsurance(
  patientId: number,
  policyId: string,
  updates: UpdateInsuranceInput,
): Promise<InsurancePolicy> {
  return apiPatch<InsurancePolicy>(
    `/patients/${patientId}/insurance/${encodeURIComponent(policyId)}`,
    updates,
  );
}
