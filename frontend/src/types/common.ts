export type Role = 'Admin' | 'Branch Manager' | 'Receptionist' | 'Doctor' | 'Cashier' | 'QA Tester';

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
  /** FK to user_account.staff_id, nullable. */
  managerStaffId?: number;
}

export interface Specialty {
  specialtyId: number;
  specialtyName: string;
}

export interface CurrentUser {
  staffId: number;
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

/** Shape of every API response envelope: { data, error }. */
export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

/** Shape of every paginated list endpoint's `data`. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
}
