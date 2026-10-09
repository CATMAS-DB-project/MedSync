import type { Role } from './common';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  staffId: number;
  username: string;
  role: Role;
  branchId: number;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

export type RefreshResponse = LoginResponse;
