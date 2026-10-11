import { useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { fetchTreatments } from '../../services/api/treatments';
import { fetchSpecialties } from '../../services/api/specialties';
import { fetchBranches } from '../../services/api/branches';
import type {
  Branch,
  Specialty,
  TreatmentCatalogueItem,
} from '../../types';

export type QaAnomalyCategory = 'Treatment' | 'Specialty' | 'Branch';

export interface QaAnomaly {
  id: string;
  category: QaAnomalyCategory;
  entity: string;
  issue: string;
}

export interface DataChecksResult {
  anomalies: QaAnomaly[];
  treatmentCount: number;
  specialtyCount: number;
  branchCount: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

function computeAnomalies(
  treatments: TreatmentCatalogueItem[],
  specialties: Specialty[],
  branches: Branch[],
  referenceLoaded: boolean,
): QaAnomaly[] {
  const list: QaAnomaly[] = [];

  // --- Treatments ---
  const seenCodes = new Set<string>();
  for (const t of treatments) {
    const code = (t.serviceCode ?? '').trim();
    if (!code) {
      list.push({
        id: `treatment:${t.treatmentName || 'unknown'}:blank-code`,
        category: 'Treatment',
        entity: t.treatmentName || 'Unknown',
        issue: 'Missing or blank service code',
      });
    } else if (seenCodes.has(code.toUpperCase())) {
      list.push({
        id: `treatment:${code}:duplicate-code`,
        category: 'Treatment',
        entity: code,
        issue: `Duplicate service code: ${code}`,
      });
    } else {
      seenCodes.add(code.toUpperCase());
    }

    if (!t.treatmentName || !t.treatmentName.trim()) {
      list.push({
        id: `treatment:${code || 'unknown'}:blank-name`,
        category: 'Treatment',
        entity: code || 'Unknown',
        issue: 'Missing or blank treatment name',
      });
    }

    const price = Number(t.unitPrice);
    if (
      t.unitPrice === null ||
      t.unitPrice === undefined ||
      String(t.unitPrice).trim() === '' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      list.push({
        id: `treatment:${code || 'unknown'}:bad-price`,
        category: 'Treatment',
        entity: code ? `${code} (${t.treatmentName})` : t.treatmentName || 'Unknown',
        issue: `Unit price is <= 0 (value: ${t.unitPrice})`,
      });
    }

    if (!t.category || !t.category.trim()) {
      list.push({
        id: `treatment:${code || 'unknown'}:blank-category`,
        category: 'Treatment',
        entity: code || t.treatmentName || 'Unknown',
        issue: 'Missing category classification',
      });
    }
  }

  // --- Specialties ---
  const seenSpecialtyNames = new Set<string>();
  for (const s of specialties) {
    const name = (s.specialtyName ?? '').trim();
    if (!name) {
      list.push({
        id: `specialty:${s.specialtyId}:blank-name`,
        category: 'Specialty',
        entity: `#${s.specialtyId}`,
        issue: 'Blank or empty specialty name',
      });
    } else if (seenSpecialtyNames.has(name.toLowerCase())) {
      list.push({
        id: `specialty:${s.specialtyId}:duplicate-name`,
        category: 'Specialty',
        entity: name,
        issue: `Duplicate specialty name: ${name}`,
      });
    } else {
      seenSpecialtyNames.add(name.toLowerCase());
    }
  }
  if (referenceLoaded && specialties.length === 0) {
    list.push({
      id: 'specialty:master:empty',
      category: 'Specialty',
      entity: 'Master table',
      issue: 'No medical specialties found in reference master',
    });
  }

  // --- Branches ---
  for (const b of branches) {
    if (!b.branchName || !b.branchName.trim()) {
      list.push({
        id: `branch:${b.branchId}:blank-name`,
        category: 'Branch',
        entity: `#${b.branchId}`,
        issue: 'Branch has missing name',
      });
    }
    if (!b.address || !b.address.trim()) {
      list.push({
        id: `branch:${b.branchId}:blank-address`,
        category: 'Branch',
        entity: b.branchName || `#${b.branchId}`,
        issue: 'Branch address is blank',
      });
    }
  }
  if (referenceLoaded && branches.length === 0) {
    list.push({
      id: 'branch:master:empty',
      category: 'Branch',
      entity: 'Master table',
      issue: 'No configured branches found',
    });
  }

  return list;
}

export function useDataChecks(enabled: boolean): DataChecksResult {
  const treatments = useAsync(
    () => (enabled ? fetchTreatments(undefined, 1, 100) : Promise.resolve(null)),
    [enabled],
  );
  const specialties = useAsync(
    () => (enabled ? fetchSpecialties(1, 100) : Promise.resolve(null)),
    [enabled],
  );
  const branches = useAsync(
    () => (enabled ? fetchBranches(1, 100) : Promise.resolve(null)),
    [enabled],
  );

  const isLoading =
    treatments.isLoading || specialties.isLoading || branches.isLoading;
  const referenceLoaded =
    treatments.data !== undefined &&
    specialties.data !== undefined &&
    branches.data !== undefined;

  const anomalies = useMemo(
    () =>
      computeAnomalies(
        treatments.data?.items ?? [],
        specialties.data?.items ?? [],
        branches.data?.items ?? [],
        referenceLoaded,
      ),
    [treatments.data, specialties.data, branches.data, referenceLoaded],
  );

  return {
    anomalies,
    treatmentCount: treatments.data?.items.length ?? 0,
    specialtyCount: specialties.data?.items.length ?? 0,
    branchCount: branches.data?.items.length ?? 0,
    isLoading,
    error: treatments.error || specialties.error || branches.error,
    reload: () => {
      treatments.reload();
      specialties.reload();
      branches.reload();
    },
  };
}
