import { apiGet } from './client';
import { asArray } from './mappers';

/**
 * Shape actually returned by GET /doctors (used for booking dropdowns).
 * It differs from the `Doctor` type in types/staff.ts: it has the doctor's
 * name and branch, and `specialties` is a list of specialty NAMES.
 */
export interface DoctorOption {
  staffId: number;
  doctorName: string;
  branchId: number;
  branchName: string;
  licenseNo: string;
  consultationFee: number;
  specialties: string[];
}

interface DoctorOptionRaw extends Omit<DoctorOption, 'specialties'> {
  specialties?: unknown; // can arrive as a JSON string from Postgres jsonb
}

export async function fetchDoctorOptions(params?: {
  branchId?: number;
  specialtyId?: number;
}): Promise<DoctorOption[]> {
  const query: Record<string, unknown> = {};
  if (params?.branchId !== undefined) query.branchId = params.branchId;
  if (params?.specialtyId !== undefined) query.specialtyId = params.specialtyId;

  const rows = await apiGet<DoctorOptionRaw[]>('/doctors', query);
  return rows.map((row) => ({ ...row, specialties: asArray<string>(row.specialties) }));
}
