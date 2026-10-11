import { fetchTreatments } from '../../services/api/treatments';
import type { TreatmentCatalogueItem } from '../../types';

const PAGE_SIZE = 100;

let cachedCatalogue: TreatmentCatalogueItem[] | null = null;
let inFlightCatalogue: Promise<TreatmentCatalogueItem[]> | null = null;

export async function fetchAllTreatments(): Promise<TreatmentCatalogueItem[]> {
  if (cachedCatalogue !== null) {
    return cachedCatalogue;
  }
  if (inFlightCatalogue !== null) {
    return inFlightCatalogue;
  }

  inFlightCatalogue = (async () => {
    const first = await fetchTreatments(undefined, 1, PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
    if (totalPages === 1) {
      cachedCatalogue = first.items;
      return first.items;
    }

    const remainingPages = Array.from(
      { length: totalPages - 1 },
      (_, idx) => idx + 2,
    );
    const rest = await Promise.all(
      remainingPages.map((page) => fetchTreatments(undefined, page, PAGE_SIZE)),
    );
    const all = [...first.items, ...rest.flatMap((res) => res.items)];
    cachedCatalogue = all;
    return all;
  })().finally(() => {
    inFlightCatalogue = null;
  });

  return inFlightCatalogue;
}

