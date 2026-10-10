import { useState, useMemo } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { fetchTreatments } from '../../../services/api/treatments';
import { fetchSpecialties } from '../../../services/api/specialties';
import { fetchBranches } from '../../../services/api/branches';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { ErrorBanner } from '../../../components/common/ErrorBanner';

interface AnomalyItem {
  id: string;
  category: 'Treatment' | 'Specialty' | 'Branch';
  entity: string;
  issue: string;
}

export function QaVerificationPanel() {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    setHealthError(null);
    const start = performance.now();
    try {
      const response = await fetch('/api/health');
      const end = performance.now();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setHealthStatus(data.status ?? 'ok');
      setLatencyMs(Math.round(end - start));
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Health check failed');
      setHealthStatus('down');
      setLatencyMs(null);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Run initial health check
  useState(() => {
    checkHealth();
  });

  // Reference checks from real API data
  const treatmentsAsync = useAsync(() => fetchTreatments(undefined, 1, 100), []);
  const specialtiesAsync = useAsync(() => fetchSpecialties(1, 100), []);
  const branchesAsync = useAsync(() => fetchBranches(1, 100), []);

  const anomalies = useMemo(() => {
    const list: AnomalyItem[] = [];

    // 1. Treatment catalogue verification
    const treatments = treatmentsAsync.data?.items ?? [];
    const seenCodes = new Set<string>();

    treatments.forEach((t) => {
      if (!t.serviceCode || !t.serviceCode.trim()) {
        list.push({
          id: `treat-code-${Math.random()}`,
          category: 'Treatment',
          entity: t.treatmentName || 'Unknown',
          issue: 'Missing or blank service code',
        });
      } else if (seenCodes.has(t.serviceCode.trim().toUpperCase())) {
        list.push({
          id: `treat-dup-${t.serviceCode}`,
          category: 'Treatment',
          entity: t.serviceCode,
          issue: `Duplicate service code: ${t.serviceCode}`,
        });
      } else {
        seenCodes.add(t.serviceCode.trim().toUpperCase());
      }

      if (!t.treatmentName || !t.treatmentName.trim()) {
        list.push({
          id: `treat-name-${t.serviceCode}`,
          category: 'Treatment',
          entity: t.serviceCode,
          issue: 'Missing or blank treatment name',
        });
      }

      if (typeof t.unitPrice !== 'number' || t.unitPrice <= 0) {
        list.push({
          id: `treat-price-${t.serviceCode}`,
          category: 'Treatment',
          entity: `${t.serviceCode} (${t.treatmentName})`,
          issue: `Unit price is <= 0 (value: ${t.unitPrice})`,
        });
      }

      if (!t.category || !t.category.trim()) {
        list.push({
          id: `treat-cat-${t.serviceCode}`,
          category: 'Treatment',
          entity: t.serviceCode,
          issue: 'Missing category classification',
        });
      }
    });

    // 2. Specialty verification
    const specialties = specialtiesAsync.data?.items ?? [];
    const seenSpecialties = new Set<string>();

    specialties.forEach((s) => {
      const name = s.specialtyName?.trim();
      if (!name) {
        list.push({
          id: `spec-empty-${s.specialtyId}`,
          category: 'Specialty',
          entity: `#${s.specialtyId}`,
          issue: 'Blank or empty specialty name',
        });
      } else if (seenSpecialties.has(name.toLowerCase())) {
        list.push({
          id: `spec-dup-${s.specialtyId}`,
          category: 'Specialty',
          entity: name,
          issue: `Duplicate specialty name: ${name}`,
        });
      } else {
        seenSpecialties.add(name.toLowerCase());
      }
    });

    if (!specialtiesAsync.isLoading && specialties.length === 0) {
      list.push({
        id: 'spec-none',
        category: 'Specialty',
        entity: 'Master Table',
        issue: 'No active medical specialties found in reference master',
      });
    }

    // 3. Branch verification
    const branches = branchesAsync.data?.items ?? [];
    branches.forEach((b) => {
      if (!b.branchName || !b.branchName.trim()) {
        list.push({
          id: `branch-name-${b.branchId}`,
          category: 'Branch',
          entity: `#${b.branchId}`,
          issue: 'Branch has missing name',
        });
      }
      if (!b.address || !b.address.trim()) {
        list.push({
          id: `branch-addr-${b.branchId}`,
          category: 'Branch',
          entity: b.branchName || `#${b.branchId}`,
          issue: 'Branch address is blank',
        });
      }
    });

    if (!branchesAsync.isLoading && branches.length === 0) {
      list.push({
        id: 'branch-none',
        category: 'Branch',
        entity: 'Master Table',
        issue: 'No configured branches found',
      });
    }

    return list;
  }, [
    treatmentsAsync.data,
    treatmentsAsync.isLoading,
    specialtiesAsync.data,
    specialtiesAsync.isLoading,
    branchesAsync.data,
    branchesAsync.isLoading,
  ]);

  const isLoadingReferences =
    treatmentsAsync.isLoading || specialtiesAsync.isLoading || branchesAsync.isLoading;
  const referenceError =
    treatmentsAsync.error || specialtiesAsync.error || branchesAsync.error;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3">
      {/* 1. System Health Card */}
      <section className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-elevated">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary-fixed p-2 text-primary">
                <Icon name="monitor_heart" size={18} />
              </span>
              <h3 className="text-headline-sm font-semibold text-on-surface">System Health</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={checkHealth}
              disabled={isCheckingHealth}
            >
              Ping
            </Button>
          </div>

          <p className="mb-4 text-body-sm text-on-surface-variant">
            Live backend health endpoint verification (<code className="text-xs">/api/health</code>).
          </p>

          {healthError ? (
            <div className="rounded-xl border border-error/30 bg-error-container/30 p-4 text-body-sm text-error" role="alert">
              <p className="font-semibold">Health check failed</p>
              <p className="text-xs mt-0.5">{healthError}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3">
                <span className="text-body-sm text-on-surface-variant">API Status</span>
                <Badge tone={healthStatus === 'ok' ? 'success' : healthStatus ? 'error' : 'neutral'}>
                  {healthStatus ?? 'Checking…'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3">
                <span className="text-body-sm text-on-surface-variant">Response Time (Browser)</span>
                <span className="text-body-md font-semibold font-mono text-on-surface">
                  {latencyMs !== null ? `${latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] text-outline">
          Status directly returned by server; response time measured locally.
        </p>
      </section>

      {/* 2. Reference & Catalogue Integrity Card */}
      <section className="flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-elevated xl:col-span-2">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-secondary-container p-2 text-secondary">
                <Icon name="fact_check" size={18} />
              </span>
              <h3 className="text-headline-sm font-semibold text-on-surface">Reference Data Verification</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={() => {
                treatmentsAsync.reload();
                specialtiesAsync.reload();
                branchesAsync.reload();
              }}
            >
              Re-scan
            </Button>
          </div>

          <p className="mb-3 text-body-sm text-on-surface-variant">
            Real-time validation across treatment catalogue pricing, medical specialties, and branch definitions.
          </p>

          {referenceError ? (
            <ErrorBanner
              message={referenceError}
              onRetry={() => {
                treatmentsAsync.reload();
                specialtiesAsync.reload();
                branchesAsync.reload();
              }}
            />
          ) : isLoadingReferences ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-8 text-center text-body-sm text-on-surface-variant animate-pulse" role="status">
              Auditing reference entities and catalogue prices…
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
              <span className="shrink-0 rounded-full bg-green-100 p-1.5 text-green-700">
                <Icon name="check_circle" size={20} />
              </span>
              <div>
                <p className="text-body-md font-medium">All reference records valid</p>
                <p className="text-body-sm text-green-700">
                  Verified {treatmentsAsync.data?.items.length ?? 0} treatments,{' '}
                  {specialtiesAsync.data?.items.length ?? 0} specialties, and{' '}
                  {branchesAsync.data?.items.length ?? 0} branches with 0 anomalies.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="mb-1 text-label-md font-semibold text-error">
                {anomalies.length} {anomalies.length === 1 ? 'anomaly detected' : 'anomalies detected'}
              </div>
              {anomalies.map((item) => (
                <div
                  key={item.id}
                  className="flex min-w-0 flex-col items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-body-sm text-on-surface sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge tone="warning">{item.category}</Badge>
                    <span className="break-all text-xs font-semibold">{item.entity}</span>
                    <span className="break-words text-xs text-on-surface-variant">{item.issue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant pt-4 text-label-md text-on-surface-variant">
          <span><span className="font-semibold text-on-surface">{treatmentsAsync.data?.items.length ?? 0}</span> Treatments</span>
          <span><span className="font-semibold text-on-surface">{specialtiesAsync.data?.items.length ?? 0}</span> Specialties</span>
          <span><span className="font-semibold text-on-surface">{branchesAsync.data?.items.length ?? 0}</span> Branches</span>
        </div>
      </section>
    </div>
  );
}
