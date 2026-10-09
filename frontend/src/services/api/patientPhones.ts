import { apiDelete, apiGet, apiPost } from './client';
import type { PagedResult, Phone, PhoneType } from '../../types';

export async function fetchPatientPhones(patientId: number): Promise<Phone[]> {
  const result = await apiGet<PagedResult<Phone>>(`/patients/${patientId}/phones`, {
    pageSize: 100,
  });
  return result.items;
}

export async function addPatientPhone(
  patientId: number,
  input: {
    phoneNumber: string;
    phoneType: PhoneType;
  },
): Promise<Phone> {
  return apiPost<Phone>(`/patients/${patientId}/phones`, {
    phoneNumber: input.phoneNumber.trim(),
    phoneType: input.phoneType,
  });
}

export async function deletePatientPhone(patientId: number, phoneId: number): Promise<void> {
  await apiDelete<unknown>(`/patients/${patientId}/phones/${phoneId}`);
}
