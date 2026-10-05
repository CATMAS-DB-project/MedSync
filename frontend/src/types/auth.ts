import type { Role } from './common';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    staff_id: number;
    username: string;
    role: Role;
    branch_id: number;
  };
}

/** Matches POST /auth/refresh's response - just a new access token. */
export interface RefreshResponse {
  access_token: string;
  token_type: string;
  user: {
    staff_id: number;
    username: string;
    role: Role;
    branch_id: number;
  };
}
