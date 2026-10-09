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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. System Health Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-surface-container-high text-on-surface">
                <Icon name="monitor_heart" size={18} />
              </span>
              <h3 className="text-headline-sm text-on-surface">System Health</h3>
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

          <p className="text-body-sm text-on-surface-variant mb-4">
            Live backend health endpoint verification (<code className="text-xs">/api/health</code>).
          </p>

          {healthError ? (
            <div className="p-3 rounded-lg bg-error-container/20 border border-error/30 text-error text-body-sm">
              <p className="font-semibold">Health check failed</p>
              <p className="text-xs mt-0.5">{healthError}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant">
                <span className="text-body-sm text-on-surface-variant">API Status</span>
                <Badge tone={healthStatus === 'ok' ? 'success' : 'error'}>
                  {healthStatus ?? 'Checking…'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant">
                <span className="text-body-sm text-on-surface-variant">Response Time (Browser)</span>
                <span className="text-body-md font-semibold font-mono text-on-surface">
                  {latencyMs !== null ? `${latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-outline mt-4">
          Status directly returned by server; response time measured locally.
        </p>
      </div>

      {/* 2. Reference & Catalogue Integrity Card */}
      <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-surface-container-high text-on-surface">
                <Icon name="fact_check" size={18} />
              </span>
              <h3 className="text-headline-sm text-on-surface">Reference Data Verification</h3>
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

          <p className="text-body-sm text-on-surface-variant mb-3">
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
            <div className="py-8 text-center text-body-sm text-on-surface-variant animate-pulse">
              Auditing reference entities and catalogue prices…
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-900">
              <span className="p-1.5 rounded-full bg-green-100 text-green-700">
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
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="text-label-md text-error font-medium mb-1">
                {anomalies.length} anomaly detected:
              </div>
              {anomalies.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-md border border-amber-200 bg-amber-50 text-on-surface text-body-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{item.category}</Badge>
                    <span className="font-semibold text-xs">{item.entity}:</span>
                    <span className="text-xs text-on-surface-variant">{item.issue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 pt-3 mt-3 border-t border-outline-variant text-label-md text-on-surface-variant">
          <span>Treatments: {treatmentsAsync.data?.items.length ?? 0}</span>
          <span>·</span>
          <span>Specialties: {specialtiesAsync.data?.items.length ?? 0}</span>
          <span>·</span>
          <span>Branches: {branchesAsync.data?.items.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

