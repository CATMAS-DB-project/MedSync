import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api/ApiError';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
}

/**
 * Minimal data-fetching hook (no extra dependency).
 * Re-runs whenever `deps` change, ignores out-of-order responses,
 * and keeps the previous data on screen while reloading.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (requestId !== latestRequest.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (requestId !== latestRequest.current) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      })
      .finally(() => {
        if (requestId === latestRequest.current) setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, error, isLoading, reload };
}
