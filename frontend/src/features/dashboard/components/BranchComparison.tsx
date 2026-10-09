import { useMemo } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { fetchBranches } from '../../../services/api/branches';
import {
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
} from '../../../services/api/reports';
import { formatCurrency } from '../../../utils/formatters';
import { TableSkeleton } from '../../../components/common/TableSkeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { EmptyState } from '../../../components/common/EmptyState';
import { ALERT_THRESHOLDS } from './dashboardThresholds';
import type { DateRange } from './DateRangeControl';

interface BranchComparisonProps {
  dateRange: DateRange;
}

interface BranchMetricRow {
  branchId: number;
  branchName: string;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
}

export function BranchComparison({ dateRange }: BranchComparisonProps) {
  const branchesAsync = useAsync(
    () => fetchBranches(1, ALERT_THRESHOLDS.BRANCH_COMPARISON_CAP),
    [],
  );

  const branches = branchesAsync.data?.items ?? [];

  const comparisonData = useAsync(async () => {
    if (branches.length === 0) return [] as BranchMetricRow[];

    const branchRows = await Promise.all(
      branches.map(async (branch) => {
        try {
          const [summaryList, revenueList] = await Promise.all([
            fetchAppointmentsSummary({
              branchId: branch.branchId,
              from: dateRange.from,
              to: dateRange.to,
            }),
            fetchDoctorRevenue({
              branchId: branch.branchId,
              from: dateRange.from,
              to: dateRange.to,
            }),
          ]);

          const totalAppointments = (summaryList ?? []).reduce(
            (sum, item) => sum + Number(item.totalCount),
            0,
          );
          const completedAppointments = (summaryList ?? []).reduce(
            (sum, item) => sum + Number(item.completedCount),
            0,
          );
          const cancelledAppointments = (summaryList ?? []).reduce(
            (sum, item) => sum + Number(item.cancelledCount),
            0,
          );
          const totalRevenue = (revenueList ?? []).reduce(
            (sum, item) => sum + Number(item.revenue),
            0,
          );

          return {
            branchId: branch.branchId,
            branchName: branch.branchName,
            totalAppointments,
            completedAppointments,
            cancelledAppointments,
            totalRevenue,
          };
        } catch {
          return {
            branchId: branch.branchId,
            branchName: branch.branchName,
            totalAppointments: 0,
            completedAppointments: 0,
            cancelledAppointments: 0,
            totalRevenue: 0,
          };
        }
      }),
    );

    return branchRows;
  }, [branches, dateRange.from, dateRange.to]);

  const rows = useMemo(() => comparisonData.data ?? [], [comparisonData.data]);
  const isLoading = branchesAsync.isLoading || comparisonData.isLoading;
  const error = branchesAsync.error || comparisonData.error;

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
      <div className="flex flex-col gap-1 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="text-headline-sm text-on-surface">Branch Performance Comparison</h3>
          <p className="text-body-sm text-on-surface-variant">
            Performance breakdown across branches (capped at {ALERT_THRESHOLDS.BRANCH_COMPARISON_CAP} branches)
          </p>
        </div>
      </div>

      {error ? (
        <div className="p-4">
          <ErrorBanner
            message={error}
            onRetry={() => {
              branchesAsync.reload();
              comparisonData.reload();
            }}
          />
        </div>
      ) : isLoading && rows.length === 0 ? (
        <div className="p-4">
          <TableSkeleton rows={4} columns={5} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No branch data available"
            description="Could not find active branches to compare."
            icon="domain"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant bg-primary-fixed/20">
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Branch</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">
                  Appointments
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">
                  Completed
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">
                  Cancelled
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">
                  Total Revenue
                </th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {rows.map((row) => (
                <tr
                  key={row.branchId}
                  className="border-b border-outline-variant odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25"
                >
                  <td className="p-table-cell-padding font-medium text-on-surface">
                    {row.branchName}
                  </td>
                  <td className="p-table-cell-padding text-on-surface text-right font-medium">
                    {row.totalAppointments}
                  </td>
                  <td className="p-table-cell-padding text-green-700 text-right">
                    {row.completedAppointments}
                  </td>
                  <td className="p-table-cell-padding text-error text-right">
                    {row.cancelledAppointments}
                  </td>
                  <td className="p-table-cell-padding font-semibold text-on-surface text-right tabular-nums">
                    {formatCurrency(row.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
