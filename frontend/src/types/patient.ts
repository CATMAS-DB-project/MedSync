import type { Gender } from './common';

export type PatientStatus = 'Active' | 'Inactive' | 'Pending';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Patient {
  id: string;
  nic: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  branch: string;
  status: PatientStatus;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: EmergencyContact;
  registeredOn: string;
  lastVisit?: string;
  avatarUrl?: string;
}
