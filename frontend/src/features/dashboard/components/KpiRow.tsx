import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from './KpiCard';
import { useAsync } from '../../../hooks/useAsync';
import {
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
  fetchOutstandingBalances,
  type OutstandingBalanceReportItem,
} from '../../../services/api/reports';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { toIsoDate, todayIso } from '../../../utils/dates';
import { ROUTES } from '../../../constants/routes';
import { daysAgoIso, type DateRange } from './DateRangeControl';

interface KpiRowProps {
  branchId?: number;
  dateRange: DateRange;
  onOutstandingDataLoaded?: (data: OutstandingBalanceReportItem[]) => void;
}

function getPreviousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const diffTime = Math.max(0, toDate.getTime() - fromDate.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const prevToDate = new Date(fromDate);
  prevToDate.setDate(prevToDate.getDate() - 1);

  const prevFromDate = new Date(prevToDate);
  prevFromDate.setDate(prevFromDate.getDate() - (diffDays - 1));

  return {
    prevFrom: toIsoDate(prevFromDate),
    prevTo: toIsoDate(prevToDate),
  };
}

export function KpiRow({ branchId, dateRange, onOutstandingDataLoaded }: KpiRowProps) {
  const navigate = useNavigate();
  const today = todayIso();
  const yesterday = daysAgoIso(1);

  // 1. Today's Appointments + Yesterday's for trend
  const todaySummary = useAsync(
    () => fetchAppointmentsSummary({ branchId, from: today, to: today }),
    [branchId, today],
  );

  const yesterdaySummary = useAsync(
    () => fetchAppointmentsSummary({ branchId, from: yesterday, to: yesterday }),
    [branchId, yesterday],
  );

  // 2. Outstanding Balances (current snapshot, no date range)
  const outstanding = useAsync(async () => {
    const res = await fetchOutstandingBalances({ branchId });
    if (onOutstandingDataLoaded) {
      onOutstandingDataLoaded(res);
    }
    return res;
  }, [branchId]);

  // 3. Revenue in date range + previous equal period
  const revenue = useAsync(
    () => fetchDoctorRevenue({ branchId, from: dateRange.from, to: dateRange.to }),
    [branchId, dateRange.from, dateRange.to],
  );

  const { prevFrom, prevTo } = useMemo(
    () => getPreviousPeriod(dateRange.from, dateRange.to),
    [dateRange.from, dateRange.to],
  );

  const prevRevenue = useAsync(
    () => fetchDoctorRevenue({ branchId, from: prevFrom, to: prevTo }),
    [branchId, prevFrom, prevTo],
  );

  // Calculations:
  const todayRow = todaySummary.data?.[0];
  const yesterdayRow = yesterdaySummary.data?.[0];

  const todayCount = todayRow?.totalCount ?? 0;
  const yesterdayCount = yesterdayRow?.totalCount ?? 0;
  const apptDiff = todayCount - yesterdayCount;
  const apptTrendText =
    yesterdaySummary.data && !todaySummary.isLoading && !yesterdaySummary.isLoading
      ? `${apptDiff >= 0 ? `+${apptDiff}` : String(apptDiff)} vs yesterday`
      : undefined;
  const apptTrendPositive = apptDiff >= 0;

  const outstandingTotal = (outstanding.data ?? []).reduce(
    (sum, row) => sum + Number(row.outstandingAmount),
    0,
  );
  const outstandingCount = outstanding.data?.length ?? 0;

  const revenueTotal = (revenue.data ?? []).reduce((sum, row) => sum + Number(row.revenue), 0);
  const prevRevenueTotal = (prevRevenue.data ?? []).reduce(
    (sum, row) => sum + Number(row.revenue),
    0,
  );

  let revenueTrendText: string | undefined;
  let revenueTrendPositive: boolean | undefined;

  if (
    !revenue.isLoading &&
    !prevRevenue.isLoading &&
    revenue.data &&
    prevRevenue.data &&
    prevRevenueTotal > 0
  ) {
    const pct = Math.round(((revenueTotal - prevRevenueTotal) / prevRevenueTotal) * 100);
    revenueTrendText = `${pct >= 0 ? `+${pct}%` : `${pct}%`} vs prev period`;
    revenueTrendPositive = pct >= 0;
  }

  const kpiDisplay = (loading: boolean, error: string | null, val: string | number) => {
    if (error) return '—';
    if (loading && val === '') return '…';
    return val;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-element-gap">
      <KpiCard
        label="Today's Appointments"
        value={kpiDisplay(
          todaySummary.isLoading,
          todaySummary.error,
          todaySummary.data ? todayCount : '',
        )}
        icon="calendar_month"
        iconTone="primary"
        trend={apptTrendText}
        trendPositive={apptTrendPositive}
        helperText={
          todaySummary.error
            ? 'Failed to load'
            : `${todayRow?.scheduledCount ?? 0} scheduled · ${todayRow?.completedCount ?? 0} completed`
        }
        caption="Click to view today's appointments"
        onClick={() => navigate(ROUTES.APPOINTMENTS)}
      />

      <KpiCard
        label="Outstanding Dues"
        value={kpiDisplay(
          outstanding.isLoading,
          outstanding.error,
          outstanding.data ? formatCurrency(outstandingTotal) : '',
        )}
        icon="payments"
        iconTone="error"
        helperText={
          outstanding.error
            ? 'Failed to load'
            : `${outstandingCount} unpaid or partial invoice${outstandingCount === 1 ? '' : 's'}`
        }
        caption="Snapshot · Does not use date range · Click to open billing"
        onClick={() => navigate(ROUTES.BILLING)}
      />

      <KpiCard
        label="Revenue"
        value={kpiDisplay(
          revenue.isLoading,
          revenue.error,
          revenue.data ? formatCurrency(revenueTotal) : '',
        )}
        icon="trending_up"
        iconTone="teal"
        trend={revenueTrendText}
        trendPositive={revenueTrendPositive}
        helperText={
          revenue.error ? 'Failed to load' : 'Doctor earnings after discounts & deductions'
        }
        caption={`Range: ${formatDate(dateRange.from)} – ${formatDate(dateRange.to)} · Click for reports`}
        onClick={() => navigate(ROUTES.REPORTS)}
      />
    </div>
  );
}
