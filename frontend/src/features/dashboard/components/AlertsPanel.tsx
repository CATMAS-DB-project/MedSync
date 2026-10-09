import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAsync } from '../../../hooks/useAsync';
import {
  fetchAppointmentsSummary,
  fetchOutstandingBalances,
} from '../../../services/api/reports';
import { formatCurrency } from '../../../utils/formatters';
import { ROUTES } from '../../../constants/routes';
import { ALERT_THRESHOLDS } from './dashboardThresholds';
import type { DateRange } from './DateRangeControl';

interface AlertsPanelProps {
  branchId?: number;
  dateRange: DateRange;
}

interface AlertItem {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function AlertsPanel({ branchId, dateRange }: AlertsPanelProps) {
  const navigate = useNavigate();

  const summary = useAsync(
    () =>
      fetchAppointmentsSummary({
        branchId,
        from: dateRange.from,
        to: dateRange.to,
      }),
    [branchId, dateRange.from, dateRange.to],
  );

  const outstanding = useAsync(
    () => fetchOutstandingBalances({ branchId }),
    [branchId],
  );

  const alerts = useMemo(() => {
    const list: AlertItem[] = [];

    // 1. Cancellation rate alert
    if (summary.data && summary.data.length > 0) {
      const totalAppointments = summary.data.reduce(
        (sum, item) => sum + Number(item.totalCount),
        0,
      );
      const totalCancelled = summary.data.reduce(
        (sum, item) => sum + Number(item.cancelledCount),
        0,
      );

      if (totalAppointments > 0) {
        const cancellationRate = totalCancelled / totalAppointments;
        if (cancellationRate >= ALERT_THRESHOLDS.CANCELLATION_RATE) {
          const ratePercent = Math.round(cancellationRate * 100);
          list.push({
            id: 'high-cancellations',
            severity: 'warning',
            title: `High Cancellation Rate (${ratePercent}%)`,
            description: `${totalCancelled} of ${totalAppointments} appointments were cancelled in the selected period. Standard threshold is ${Math.round(
              ALERT_THRESHOLDS.CANCELLATION_RATE * 100,
            )}%.`,
            actionLabel: 'View Appointments',
            onAction: () => navigate(ROUTES.APPOINTMENTS),
          });
        }
      }
    }

    // 2. Outstanding balances alert
    if (outstanding.data && outstanding.data.length > 0) {
      const count = outstanding.data.length;
      const totalAmount = outstanding.data.reduce(
        (sum, item) => sum + Number(item.outstandingAmount),
        0,
      );

      if (
        count >= ALERT_THRESHOLDS.OUTSTANDING_BALANCE_COUNT ||
        totalAmount >= ALERT_THRESHOLDS.OUTSTANDING_BALANCE_AMOUNT
      ) {
        list.push({
          id: 'outstanding-dues',
          severity: totalAmount >= ALERT_THRESHOLDS.OUTSTANDING_BALANCE_AMOUNT ? 'error' : 'warning',
          title: `Significant Outstanding Balances (${formatCurrency(totalAmount)})`,
          description: `There are ${count} unpaid or partially paid patient invoice${
            count === 1 ? '' : 's'
          } requiring follow-up.`,
          actionLabel: 'Open Billing Queue',
          onAction: () => navigate(ROUTES.BILLING),
        });
      }
    }

    return list;
  }, [summary.data, outstanding.data, navigate]);

  const hasError = summary.error || outstanding.error;
  const isLoading = summary.isLoading || outstanding.isLoading;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-surface-container-high text-on-surface">
            <Icon name="notifications" size={18} />
          </span>
          <h3 className="text-headline-sm text-on-surface">System Alerts</h3>
        </div>
        {alerts.length > 0 && (
          <span className="text-label-md px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-medium">
            {alerts.length} action{alerts.length === 1 ? '' : 's'} required
          </span>
        )}
      </div>

      {hasError ? (
        <ErrorBanner
          message={summary.error || outstanding.error || 'Failed to check alerts'}
          onRetry={() => {
            if (summary.error) summary.reload();
            if (outstanding.error) outstanding.reload();
          }}
        />
      ) : isLoading && alerts.length === 0 ? (
        <div className="py-6 text-center text-body-sm text-on-surface-variant animate-pulse">
          Evaluating operational thresholds…
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-900">
          <span className="p-1.5 rounded-full bg-green-100 text-green-700">
            <Icon name="check_circle" size={20} />
          </span>
          <div>
            <p className="text-body-md font-medium">All indicators healthy</p>
            <p className="text-body-sm text-green-700">
              Cancellation rates and outstanding dues are within normal operating thresholds.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                alert.severity === 'error'
                  ? 'bg-error-container/20 border-error/30 text-on-surface'
                  : 'bg-amber-50 border-amber-200 text-on-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`p-1.5 rounded-full shrink-0 ${
                    alert.severity === 'error'
                      ? 'bg-error-container text-error'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <Icon
                    name={alert.severity === 'error' ? 'error' : 'warning'}
                    size={20}
                  />
                </span>
                <div>
                  <h4 className="text-body-md font-semibold text-on-surface">{alert.title}</h4>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{alert.description}</p>
                </div>
              </div>

              <Button
                variant={alert.severity === 'error' ? 'primary' : 'secondary'}
                size="sm"
                onClick={alert.onAction}
                className="shrink-0 self-end sm:self-center"
              >
                {alert.actionLabel}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
