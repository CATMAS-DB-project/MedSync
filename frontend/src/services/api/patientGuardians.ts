import { apiDelete, apiGet, apiPost } from './client';
import { toGuardianLink } from './mappers';
import type { GuardianLinkRaw } from './mappers';
import { rethrowUniqueViolation } from './serviceErrors';
import type { PagedResult, PatientGuardianLink } from '../../types';

export interface NewGuardianInput {
  firstName: string;
  lastName: string;
  nic?: string;
  address?: string;
}

export type LinkGuardianInput =
  | { relationship: string; guardianId: number }
  | { relationship: string; newGuardian: NewGuardianInput };

export async function fetchPatientGuardians(patientId: number): Promise<PatientGuardianLink[]> {
  const result = await apiGet<PagedResult<GuardianLinkRaw>>(`/patients/${patientId}/guardians`, {
    pageSize: 100,
  });
  return result.items.map((row) => toGuardianLink(patientId, row));
}

export async function linkGuardianToPatient(
  patientId: number,
  input: LinkGuardianInput,
): Promise<PatientGuardianLink> {
  const body =
    'guardianId' in input
      ? { relationship: input.relationship.trim(), guardianId: input.guardianId }
      : {
          relationship: input.relationship.trim(),
          newGuardian: {
            firstName: input.newGuardian.firstName.trim(),
            lastName: input.newGuardian.lastName.trim(),
            nic: input.newGuardian.nic?.trim() || undefined,
            address: input.newGuardian.address?.trim() || undefined,
          },
        };

  try {
    return await apiPost<PatientGuardianLink>(`/patients/${patientId}/guardians`, body);
  } catch (error) {
    rethrowUniqueViolation(
      error,
      'A guardian with this NIC already exists. Search for them and link the existing guardian instead.',
    );
  }
}

export async function unlinkGuardianFromPatient(
  patientId: number,
  guardianId: number,
): Promise<void> {
  await apiDelete<unknown>(`/patients/${patientId}/guardians/${guardianId}`);
}
