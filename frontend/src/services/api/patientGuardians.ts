import { apiDelete, apiGet, apiPost } from './client';
import type { PatientGuardianLink, PhoneType } from '../../types';

export async function fetchPatientGuardians(patientId: number): Promise<PatientGuardianLink[]> {
  return apiGet<PatientGuardianLink[]>(`/patients/${patientId}/guardians`);
}

export interface LinkGuardianToPatientInput {
  guardianId?: number;
  relationship: string;
  firstName?: string;
  lastName?: string;
  nic?: string;
  address?: string;
  phoneNumber?: string;
  phoneType?: PhoneType;
}

export async function linkGuardianToPatient(
  patientId: number,
  input: LinkGuardianToPatientInput,
): Promise<PatientGuardianLink> {
  return apiPost<PatientGuardianLink>(`/patients/${patientId}/guardians`, input);
}

export async function unlinkGuardianFromPatient(
  patientId: number,
  guardianId: number,
): Promise<void> {
  await apiDelete<void>(`/patients/${patientId}/guardians/${guardianId}`);
}
