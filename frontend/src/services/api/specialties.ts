import { apiGet, apiPatch, apiPost } from './client';
import type { Specialty, PagedResult } from '../../types';

export async function fetchSpecialties(page = 1, pageSize = 25): Promise<PagedResult<Specialty>> {
  return apiGet<PagedResult<Specialty>>('/specialties', { page, pageSize });
}

export async function createSpecialty(input: { specialtyName: string }): Promise<Specialty> {
  return apiPost<Specialty>('/specialties', input);
}

export async function updateSpecialty(
  specialtyId: number,
  updates: Partial<Pick<Specialty, 'specialtyName'>>,
): Promise<Specialty> {
  return apiPatch<Specialty>(`/specialties/${specialtyId}`, updates);
}
