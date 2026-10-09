export type Role = 'Admin' | 'Branch Manager' | 'Receptionist' | 'Doctor' | 'QA Tester';

export type Gender = 'Male' | 'Female' | 'Other';

export type EmploymentStatus = 'Active' | 'OnLeave' | 'Terminated';

export type AccountStatus = 'Active' | 'Disabled';

export type PhoneType = 'Mobile' | 'Home' | 'Work';

export interface Phone {
  phoneId: number;
  phoneNumber: string;
  phoneType: PhoneType;
}

export interface Branch {
  branchId: number;
  branchName: string;
  address: string;
  contactNumber?: string;
  managerStaffId?: number;
}

export interface Specialty {
  specialtyId: number;
  specialtyName: string;
}

export interface CurrentUser {
  staffId: number;
  username?: string;
  firstName: string;
  lastName: string;
  role: Role;
  branchId: number;
  branchName: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState<TColumn extends string = string> {
  column: TColumn;
  direction: SortDirection;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiErrorBody | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
