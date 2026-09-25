import type { Role } from './common';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  staffId: number;
  role: Role;
  branchId: number;
}

/** Matches POST /auth/refresh's response - just a new access token. */
export interface RefreshResponse {
  accessToken: string;
}
