import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchSystemHealth,
  HEALTH_TIMEOUT_MS,
} from '../../services/api/health';

const REFRESH_MS = 60_000;

export type SystemHealthStatus = 'idle' | 'ok' | 'down';

export interface SystemHealthState {
  status: SystemHealthStatus;
  latencyMs: number | null;
  lastChecked: Date | null;
  error: string | null;
}

export interface UseSystemHealthResult {
  state: SystemHealthState;
  isChecking: boolean;
  check: () => void;
}

const INITIAL: SystemHealthState = {
  status: 'idle',
  latencyMs: null,
  lastChecked: null,
  error: null,
};

export function useSystemHealth(enabled: boolean): UseSystemHealthResult {
  const [state, setState] = useState<SystemHealthState>(INITIAL);
  const [isChecking, setIsChecking] = useState(false);
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false);

  const check = useCallback(async () => {
    if (!enabled) return;
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT_MS,
    );
    const start = performance.now();

    try {
      await fetchSystemHealth(controller.signal);
      const elapsed = Math.round(performance.now() - start);
      if (!isMountedRef.current) return;
      setState({
        status: 'ok',
        latencyMs: elapsed,
        lastChecked: new Date(),
        error: null,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setState({
        status: 'down',
        latencyMs: null,
        lastChecked: new Date(),
        error:
          err instanceof Error
            ? err.name === 'AbortError' || err.name === 'CanceledError'
              ? `Timed out after ${HEALTH_TIMEOUT_MS} ms`
              : err.message
            : 'Health check failed',
      });
    } finally {
      window.clearTimeout(timeoutId);
      isCheckingRef.current = false;
      if (isMountedRef.current) setIsChecking(false);
    }
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, check]);

  return { state, isChecking, check };
}
