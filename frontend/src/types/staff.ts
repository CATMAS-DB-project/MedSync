import type { Gender, StaffRole } from './common';

export type StaffStatus = 'Active' | 'On Leave' | 'Inactive';

export interface StaffMember {
  id: string;
  nic: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: Gender;
  role: StaffRole;
  specialty?: string;
  branch: string;
  phone: string;
  email: string;
  status: StaffStatus;
  joinedOn: string;
  avatarUrl?: string;
}
