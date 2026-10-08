import { apiGet, apiPatch, apiPost } from './client';
import type { TreatmentCatalogueItem, PagedResult } from '../../types';

export interface CreateTreatmentInput {
  serviceCode: string;
  treatmentName: string;
  unitPrice: number;
  category: string;
}

export async function fetchTreatments(category?: string, page = 1, pageSize = 25): Promise<PagedResult<TreatmentCatalogueItem>> {
  return apiGet<PagedResult<TreatmentCatalogueItem>>('/treatments', { category, page, pageSize });
}

export async function fetchTreatmentByCode(serviceCode: string): Promise<TreatmentCatalogueItem> {
  return apiGet<TreatmentCatalogueItem>(`/treatments/${serviceCode}`);
}

export async function createTreatment(input: CreateTreatmentInput): Promise<TreatmentCatalogueItem> {
  return apiPost<TreatmentCatalogueItem>('/treatments', input);
}

export async function updateTreatment(
  serviceCode: string,
  updates: Partial<Omit<TreatmentCatalogueItem, 'serviceCode'>>,
): Promise<TreatmentCatalogueItem> {
  return apiPatch<TreatmentCatalogueItem>(`/treatments/${serviceCode}`, updates);
}
