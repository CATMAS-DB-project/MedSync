import { useMemo } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { QaHealthCard } from './QaHealthCard';
import type { DataChecksResult, QaAnomaly, QaAnomalyCategory } from '../useDataChecks';
import type { SystemHealthState } from '../useSystemHealth';

export interface QaVerificationPanelProps {
  checks: DataChecksResult;
  health: {
    state: SystemHealthState;
    isChecking: boolean;
    check: () => void;
  };
}

const CATEGORY_ORDER: QaAnomalyCategory[] = ['Treatment', 'Specialty', 'Branch'];

export function QaVerificationPanel({ checks, health }: QaVerificationPanelProps) {
  const grouped = useMemo(() => {
    const map: Record<QaAnomalyCategory, QaAnomaly[]> = {
      Treatment: [],
      Specialty: [],
      Branch: [],
    };
    for (const a of checks.anomalies) map[a.category].push(a);
    return map;
  }, [checks.anomalies]);

  const isLoading = checks.isLoading && checks.anomalies.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <QaHealthCard
        state={health.state}
        isChecking={health.isChecking}
        onPing={health.check}
      />

      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-headline-sm text-on-surface">Reference data</h3>
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={checks.reload}
            disabled={checks.isLoading}
            isLoading={checks.isLoading}
          >
            Re-scan
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CountCard label="Treatments" value={checks.treatmentCount} />
          <CountCard label="Specialties" value={checks.specialtyCount} />
          <CountCard label="Branches" value={checks.branchCount} />
        </div>
      </section>

      {checks.error ? (
        <ErrorBanner message={checks.error} onRetry={checks.reload} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} rounded="xl" />
          ))}
        </div>
      ) : checks.anomalies.length === 0 ? (
        <EmptyState icon="check_circle" title="All records valid" />
      ) : (
        <div className="flex flex-col gap-3">
          {CATEGORY_ORDER.map((category) => {
            const items = grouped[category];
            if (items.length === 0) return null;
            return (
              <div
                key={category}
                className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-card"
              >
                <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
                  <h4 className="text-headline-sm text-on-surface">{category}</h4>
                  <Badge tone="warning" dot pill>
                    {items.length}
                  </Badge>
                </header>
                <ul className="flex flex-col divide-y divide-outline-variant">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body-sm font-semibold text-on-surface">
                          {item.entity}
                        </div>
                        <div className="truncate text-label-md text-on-surface-variant">
                          {item.issue}
                        </div>
                      </div>
                      <Badge tone="neutral" pill>
                        {item.category}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
      <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-display-sm font-bold text-on-surface">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
