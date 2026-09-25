import { apiGet, apiPatch, apiPost } from './client';
import type { Specialty } from '../../types';

export async function fetchSpecialties(): Promise<Specialty[]> {
  return apiGet<Specialty[]>('/specialties');
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
