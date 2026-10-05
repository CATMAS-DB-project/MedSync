export type ApiErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  code: string;
  status: number;
  details: ApiErrorDetails;

  constructor(message: string, code: string, status: number, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** 403 - logged in, but the role is not allowed to do this. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** 409 - unique violation, overlapping appointment, duplicate NIC, etc. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** 422 - request body or query failed validation. */
  get isValidation(): boolean {
    return this.status === 422;
  }

  get existingPatientId(): number | undefined {
    const id = this.details.patientId;
    return typeof id === 'number' ? id : undefined;
  }
}
