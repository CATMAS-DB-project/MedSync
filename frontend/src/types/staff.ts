import type { AccountStatus, EmploymentStatus, Gender, Phone, Role, Specialty } from './common';

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
  roleId?: number;
  roleName?: Role;
  accountStatus: AccountStatus;
  lastLogin?: string;
  createdAt?: string;
}

export interface StaffRecord extends Staff {
  isDoctor: boolean;
  hasAccount: boolean;
  createdAt?: string;
  doctor?: Doctor;
  userAccount?: UserAccount;
}

