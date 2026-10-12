import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatCurrency, formatTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import type { AppointmentStatus, AppointmentTreatment } from '../../../types';

export interface ConsultationTreatmentsCardProps {
  status: AppointmentStatus;
  records: AppointmentTreatment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  canAmend: boolean;
  canAdd: boolean;
  /** True while the page is preparing to open the picker (e.g. completing the visit first). */
  isPreparingToAdd?: boolean;
  onAmend: (record: AppointmentTreatment) => void;
  onAdd: () => void;
}

function timeFromIso(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ConsultationTreatmentsCard({
  status,
  records,
  loading,
  error,
  onRetry,
  canAmend,
  canAdd,
  isPreparingToAdd = false,
  onAmend,
  onAdd,
}: ConsultationTreatmentsCardProps) {
  const supersededIds = new Set(
    records.map((r) => r.originalRecordId).filter((id): id is number => id != null),
  );
  const isFirstLoad = loading && records.length === 0;
  const isCancelled = status === 'Cancelled';

  return (
    <Card padding="none">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
        <h2 className="text-headline-sm text-on-surface">Treatments</h2>
        {canAdd && !isCancelled && (
          <Button
            variant="secondary"
            size="sm"
            icon="add"
            onClick={onAdd}
            disabled={isPreparingToAdd}
            isLoading={isPreparingToAdd}
          >
            Add treatment
          </Button>
        )}
      </header>

      {error && (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={onRetry} />
        </div>
      )}

      {!error && isFirstLoad && (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={48} rounded="xl" />
          ))}
        </div>
      )}

      {!error && !isFirstLoad && records.length === 0 && (
        <div className="py-2">
          <EmptyState icon="medical_services" title="No treatments logged" />
        </div>
      )}

      {!error && records.length > 0 && (
        <ul className="flex flex-col divide-y divide-outline-variant">
          {records.map((record) => {
            const superseded = supersededIds.has(record.appointmentTreatmentId);
            return (
              <li
                key={record.appointmentTreatmentId}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className={cn('min-w-0', superseded && 'opacity-50')}>
                  <div
                    className={cn(
                      'text-body-sm font-medium text-on-surface',
                      superseded && 'line-through',
                    )}
                  >
                    {record.treatmentName ?? record.serviceCode}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
                    <span className="font-mono">{record.serviceCode}</span>
                    {record.recordedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatTime(timeFromIso(record.recordedAt))}</span>
                      </>
                    )}
                    {record.isAmended && (
                      <Badge tone="warning" pill dot>
                        Amended
                      </Badge>
                    )}
                  </div>
                  {record.amendmentReason && (
                    <div className="mt-0.5 truncate text-label-md text-on-surface-variant">
                      {record.amendmentReason}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-body-sm text-on-surface">
                    {formatCurrency(Number(record.priceAtTime))}
                  </span>
                  {canAmend && !superseded && (
                    <button
                      type="button"
                      onClick={() => onAmend(record)}
                      className="rounded-md px-2 py-1 text-label-md font-medium text-primary hover:bg-primary-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Amend
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Small muted hint only while we're completing the visit in the background. */}
      {canAdd && !isCancelled && (status === 'Scheduled' || status === 'Re-Scheduled') && (
        <footer className="flex items-center gap-2 border-t border-outline-variant px-4 py-2.5 text-label-md text-on-surface-variant sm:px-5">
          <Icon name="info" size={14} />
          Adding a treatment will complete this visit
        </footer>
      )}
    </Card>
  );
}
