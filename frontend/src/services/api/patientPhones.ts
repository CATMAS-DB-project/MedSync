import { apiDelete, apiGet, apiPost } from './client';
import type { Phone, PhoneType } from '../../types';

export async function fetchPatientPhones(patientId: number): Promise<Phone[]> {
  return apiGet<Phone[]>(`/patients/${patientId}/phones`);
}

export async function addPatientPhone(
  patientId: number,
  input: {
    phoneNumber: string;
    phoneType: PhoneType;
  },
): Promise<Phone> {
  return apiPost<Phone>(`/patients/${patientId}/phones`, input);
}

export async function deletePatientPhone(patientId: number, phoneId: number): Promise<void> {
  await apiDelete<void>(`/patients/${patientId}/phones/${phoneId}`);
}
