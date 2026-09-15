export interface Branch {
  id: string;
  name: string;
}

export type StaffRole = 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist';

export interface CurrentUser {
  id: string;
  name: string;
  role: StaffRole;
  branch: string;
  avatarUrl?: string;
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

export type Gender = 'Male' | 'Female' | 'Other';
