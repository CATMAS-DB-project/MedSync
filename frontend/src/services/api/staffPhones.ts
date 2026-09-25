import { apiDelete, apiGet, apiPost } from './client';
import type { Phone, PhoneType } from '../../types';

export async function fetchStaffPhones(staffId: number): Promise<Phone[]> {
  return apiGet<Phone[]>(`/staff/${staffId}/phones`);
}

export async function addStaffPhone(
  staffId: number,
  input: {
    phoneNumber: string;
    phoneType: PhoneType;
  },
): Promise<Phone> {
  return apiPost<Phone>(`/staff/${staffId}/phones`, input);
}

export async function deleteStaffPhone(staffId: number, phoneId: number): Promise<void> {
  await apiDelete<void>(`/staff/${staffId}/phones/${phoneId}`);
}
