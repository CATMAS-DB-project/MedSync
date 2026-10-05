import { ApiError } from './ApiError';

export function rethrowUniqueViolation(error: unknown, message: string): never {
  if (error instanceof ApiError && error.code === 'unique_violation') {
    throw new ApiError(message, error.code, error.status, error.details);
  }
  throw error;
}
