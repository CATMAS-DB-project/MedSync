import { apiGet, apiPatch, apiPost } from './client';
import { asArray } from './mappers';
import { rethrowUniqueViolation } from './serviceErrors';
import type { Guardian, PagedResult, Phone, PhoneType } from '../../types';

export interface GuardianListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  nic?: string;
  address?: string;
}

export interface UpdateGuardianInput {
  firstName?: string;
  lastName?: string;
  nic?: string | null;
  address?: string | null;
}

export interface GuardianPatientLink {
  patientId: number;
  firstName: string;
  lastName: string;
  nicPassportNo: string;
  relationship: string;
}

export interface GuardianDetail extends Guardian {
  phones: Phone[];
  patients: GuardianPatientLink[];
}

interface GuardianRaw {
  guardianId: number;
  firstName: string;
  lastName: string;
  nic?: string | null;
  address?: string | null;
  createdAt: string;
  phones?: unknown;
  patients?: unknown;
}

function toGuardian(raw: GuardianRaw): Guardian {
  return {
    guardianId: raw.guardianId,
    firstName: raw.firstName,
    lastName: raw.lastName,
    nic: raw.nic ?? undefined,
    address: raw.address ?? undefined,
    createdAt: raw.createdAt,
  };
}

/** An empty string would fail backend validation; treat it as "not provided". */
function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** For updates: an empty string means "clear the value". */
function blankToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const NIC_TAKEN_MESSAGE =
  'A guardian with this NIC already exists. Search for them and link the existing guardian instead.';

/** GET /guardians - Receptionist only. */
export async function fetchGuardians(params?: GuardianListParams): Promise<PagedResult<Guardian>> {
  const queryParams: Record<string, unknown> = {};

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    });
  }
  if (typeof queryParams.search === 'string') {
    const trimmed = queryParams.search.trim();
    if (trimmed) {
      queryParams.search = trimmed;
    } else {
      delete queryParams.search;
    }
  }

  const result = await apiGet<PagedResult<GuardianRaw>>('/guardians', queryParams);
  return { ...result, items: result.items.map(toGuardian) };
}

export async function fetchGuardianById(guardianId: number): Promise<GuardianDetail> {
  const raw = await apiGet<GuardianRaw>(`/guardians/${guardianId}`);
  return {
    ...toGuardian(raw),
    phones: asArray<Phone>(raw.phones),
    patients: asArray<GuardianPatientLink>(raw.patients),
  };
}

export async function createGuardian(input: CreateGuardianInput): Promise<Guardian> {
  try {
    const raw = await apiPost<GuardianRaw>('/guardians', {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      nic: blankToUndefined(input.nic),
      address: blankToUndefined(input.address),
    });
    return toGuardian(raw);
  } catch (error) {
    rethrowUniqueViolation(error, NIC_TAKEN_MESSAGE);
  }
}

export async function updateGuardian(
  guardianId: number,
  updates: UpdateGuardianInput,
): Promise<Guardian> {
  try {
    const raw = await apiPatch<GuardianRaw>(`/guardians/${guardianId}`, {
      firstName: updates.firstName?.trim(),
      lastName: updates.lastName?.trim(),
      nic: blankToNull(updates.nic),
      address: blankToNull(updates.address),
    });
    return toGuardian(raw);
  } catch (error) {
    rethrowUniqueViolation(error, NIC_TAKEN_MESSAGE);
  }
}

export async function fetchGuardianPhones(guardianId: number): Promise<Phone[]> {
  const result = await apiGet<PagedResult<Phone>>(`/guardians/${guardianId}/phones`, {
    pageSize: 100,
  });
  return result.items;
}

export async function addGuardianPhone(
  guardianId: number,
  input: { phoneNumber: string; phoneType: PhoneType },
): Promise<Phone> {
  return apiPost<Phone>(`/guardians/${guardianId}/phones`, {
    phoneNumber: input.phoneNumber.trim(),
    phoneType: input.phoneType,
  });
}
