import type { Gender, Phone } from './common';

export interface Patient {
  patientId: number;
  nicPassportNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
  registeredBranchId: number;
  registeredBranchName?: string;
  createdAt: string;
  phones?: Phone[];
}

export interface Guardian {
  guardianId: number;
  firstName: string;
  lastName: string;
  nic?: string;
  address?: string;
  createdAt: string;
  phones?: Phone[];
}

export interface PatientGuardianLink {
  patientId: number;
  guardianId: number;
  relationship: string;
  guardian?: Guardian;
}

export type InsuranceStatus = 'Active' | 'Inactive';

export interface InsurancePolicy {
  policyId: string;
  patientId: number;
  providerName: string;
  coverageLevel: string;
  status: InsuranceStatus;
}
