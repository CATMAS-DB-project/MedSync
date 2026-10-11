import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../services/api/ApiError';
import { fetchBranches } from '../services/api/branches';
import type { Branch } from '../types';

let cachedBranches: Branch[] | null = null;
let inFlightPromise: Promise<Branch[]> | null = null;

function loadBranches(force = false): Promise<Branch[]> {
  if (!force && cachedBranches !== null) {
    return Promise.resolve(cachedBranches);
  }
  if (!force && inFlightPromise !== null) {
    return inFlightPromise;
  }

  inFlightPromise = fetchBranches(1, 100)
    .then((res) => {
      cachedBranches = res.items;
      return res.items;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

export interface UseBranchNamesResult {
  branches: Branch[];
  branchMap: ReadonlyMap<number, string>;
  getBranchName: (branchId?: number | null) => string | undefined;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useBranchNames(enabled = true): UseBranchNamesResult {
  const [branches, setBranches] = useState<Branch[]>(() => cachedBranches ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => enabled && cachedBranches === null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const force = reloadTick > 0;
    if (!force && cachedBranches !== null) {
      setBranches(cachedBranches);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadBranches(force)
      .then((items) => {
        if (!cancelled) {
          setBranches(items);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Unable to load branches.',
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadTick]);

  const branchMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const branch of branches) {
      map.set(branch.branchId, branch.branchName);
    }
    return map;
  }, [branches]);

  const getBranchName = useCallback(
    (branchId?: number | null) => {
      if (branchId === undefined || branchId === null) return undefined;
      return branchMap.get(branchId);
    },
    [branchMap],
  );

  const reload = useCallback(() => {
    cachedBranches = null;
    setReloadTick((t) => t + 1);
  }, []);

  return {
    branches,
    branchMap,
    getBranchName,
    isLoading,
    error,
    reload,
  };
}

