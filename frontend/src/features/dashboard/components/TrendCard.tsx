import { useMemo } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointmentsSummary } from '../../../services/api/reports';
import { formatDate } from '../../../utils/formatters';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { EmptyState } from '../../../components/common/EmptyState';
import type { DateRange } from './DateRangeControl';

interface TrendCardProps {
  branchId?: number;
  dateRange: DateRange;
}

export function TrendCard({ branchId, dateRange }: TrendCardProps) {
  const summary = useAsync(
    () =>
      fetchAppointmentsSummary({
        branchId,
        from: dateRange.from,
        to: dateRange.to,
      }),
    [branchId, dateRange.from, dateRange.to],
  );

  const data = summary.data ?? [];

  const { bars, maxTotal, overallTotal, overallCompleted, overallCancelled } = useMemo(() => {
    let max = 1;
    let total = 0;
    let completed = 0;
    let cancelled = 0;

    const items = data.map((item) => {
      const itemTotal = Number(item.totalCount) || 0;
      const itemCompleted = Number(item.completedCount) || 0;
      const itemCancelled = Number(item.cancelledCount) || 0;

      if (itemTotal > max) max = itemTotal;
      total += itemTotal;
      completed += itemCompleted;
      cancelled += itemCancelled;

      const dateObj = new Date(`${item.appointmentDate.slice(0, 10)}T00:00:00`);
      const label =
        data.length <= 7
          ? dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          : dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

      return {
        date: item.appointmentDate.slice(0, 10),
        label,
        total: itemTotal,
        completed: itemCompleted,
        cancelled: itemCancelled,
      };
    });

    return {
      bars: items,
      maxTotal: max,
      overallTotal: total,
      overallCompleted: completed,
      overallCancelled: cancelled,
    };
  }, [data]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated sm:p-5">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-secondary" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-headline-sm text-on-surface">Appointment Trends</h3>
          <p className="text-body-sm text-on-surface-variant">
            {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
          </p>
        </div>
        {!summary.isLoading && !summary.error && data.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-body-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">Total: {overallTotal}</span>
            <span>·</span>
            <span className="text-green-700">Completed: {overallCompleted}</span>
            <span>·</span>
            <span className="text-error">Cancelled: {overallCancelled}</span>
          </div>
        )}
      </div>

      {summary.error ? (
        <ErrorBanner message={summary.error} onRetry={summary.reload} />
      ) : summary.isLoading && data.length === 0 ? (
        <div className="h-44 flex items-center justify-center">
          <div className="animate-pulse text-body-sm text-on-surface-variant">Loading appointment trends…</div>
        </div>
      ) : bars.length === 0 || overallTotal === 0 ? (
        <EmptyState
          title="No appointments in this period"
          description="There were no appointments recorded for the selected date range and branch."
          icon="event_busy"
        />
      ) : (
        <div className="pt-2">
          <div className="flex items-end gap-2 h-44 overflow-x-auto pb-2">
            {bars.map((bar) => {
              const heightPct = Math.round((bar.total / maxTotal) * 100);
              const completedPct = bar.total > 0 ? Math.round((bar.completed / bar.total) * 100) : 0;

              return (
                <div
                  key={bar.date}
                  className="flex-1 min-w-[2.5rem] flex flex-col items-center justify-end gap-1.5 h-full group relative"
                >
                  <span className="text-label-md text-on-surface-variant font-medium">
                    {bar.total > 0 ? bar.total : ''}
                  </span>
                  <div
                    className="w-full max-w-[2.5rem] rounded-t bg-surface-container-high overflow-hidden flex flex-col justify-end transition-all"
                    style={{ height: `${heightPct}%`, minHeight: bar.total > 0 ? '6px' : '2px' }}
                    title={`${bar.date}: ${bar.total} total (${bar.completed} completed, ${bar.cancelled} cancelled)`}
                  >
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${completedPct}%` }}
                    />
                  </div>
                  <span className="text-label-md text-outline truncate max-w-full text-center">
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-outline-variant text-label-md text-on-surface-variant">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-primary" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-surface-container-high" />
              <span>Other statuses</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
