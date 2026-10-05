import { transformResponsePayload } from './transformers';
import type {
  Gender,
  InsurancePolicy,
  Patient,
  PatientGuardianLink,
  Phone,
} from '../../types';

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return transformResponsePayload(parsed) as T[];
    } catch {

    }
  }
  return [];
}

export interface GuardianLinkRaw {
  guardianId: number;
  firstName: string;
  lastName: string;
  nic?: string | null;
  relationship: string;
}

export function toGuardianLink(patientId: number, raw: GuardianLinkRaw): PatientGuardianLink {
  return {
    patientId,
    guardianId: raw.guardianId,
    relationship: raw.relationship,
    guardian: {
      guardianId: raw.guardianId,
      firstName: raw.firstName,
      lastName: raw.lastName,
      nic: raw.nic ?? undefined,
    },
  };
}

export interface PatientRaw {
  patientId: number;
  nicPassportNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string | null;
  registeredBranchId: number;
  registeredBranch?: string;
  createdAt: string;
  phones?: unknown;
  guardians?: unknown;
  insurance?: unknown;
}

export function toPatient(raw: PatientRaw): Patient {
  const patient: Patient = {
    patientId: raw.patientId,
    nicPassportNo: raw.nicPassportNo,
    firstName: raw.firstName,
    lastName: raw.lastName,
    dateOfBirth: raw.dateOfBirth,
    gender: raw.gender,
    address: raw.address ?? undefined,
    registeredBranchId: raw.registeredBranchId,
    registeredBranchName: raw.registeredBranch,
    createdAt: raw.createdAt,
  };

  if (raw.phones !== undefined) {
    patient.phones = asArray<Phone>(raw.phones);
  }
  if (raw.guardians !== undefined) {
    patient.guardians = asArray<GuardianLinkRaw>(raw.guardians).map((g) =>
      toGuardianLink(raw.patientId, g),
    );
  }
  if (raw.insurance !== undefined) {
    patient.insurance = asArray<InsurancePolicy>(raw.insurance);
  }
  return patient;
}
