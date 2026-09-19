import type { AccountStatus, EmploymentStatus, Gender, Phone, Role, Specialty } from './common';

/**
 * Matches the `staff` table — the HR superclass for every employee.
 * A staff record may or may not also have a Doctor and/or UserAccount
 * subtype; those are separate optional records, not fields here.
 */
export interface Staff {
  staffId: number;
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
  branchId: number;
  branchName?: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  phones?: Phone[];
}

export interface Doctor {
  staffId: number;
  licenseNo: string;
  yearsOfExperience: number;
  consultationFee: number;
  qualifications?: string;
  specialties: Specialty[];
}

export interface UserAccount {
  staffId: number;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  lastLogin?: string;
}

export interface StaffRecord extends Staff {
  doctor?: Doctor;
  userAccount?: UserAccount;
}
