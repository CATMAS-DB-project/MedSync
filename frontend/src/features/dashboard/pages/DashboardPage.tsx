import { useCallback, useMemo} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useBranchNames } from '../../../hooks/useBranchNames';
import {
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
  fetchInsuranceVsOutOfPocket,
  fetchOutstandingBalances,
} from '../../../services/api/reports';
import type {
  AppointmentSummaryReportItem,
  DoctorRevenueReportItem,
  InsuranceVsOutOfPocketReport,
  OutstandingBalanceReportItem,
} from '../../../services/api/reports';
import { daysAgoIso, todayIso, toIsoDate } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/formatters';
import { formatPercent } from '../../../components/charts/chartTheme';
import { ALERT_THRESHOLDS } from '../components/dashboardThresholds';
import { DashboardAttention } from '../components/DashboardAttention';
import type { AttentionChip } from '../components/DashboardAttention';
import { DashboardFilters } from '../components/DashboardFilters';
import type { RangePreset } from '../components/DashboardFilters';
import { DashboardKpis } from '../components/DashboardKpis';
import type { DashboardKpiItem, StatDelta } from '../components/DashboardKpis';
import { DashboardCharts } from '../components/DashboardCharts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | null, fallback: string): string {
  return value && ISO_DATE.test(value) ? value : fallback;
}

function parseId(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function detectPreset(from: string, to: string): RangePreset {
  if (to !== todayIso()) return 'custom';
  if (from === daysAgoIso(6)) return '7d';
  if (from === daysAgoIso(29)) return '30d';
  if (from === daysAgoIso(89)) return '90d';
  return 'custom';
}

function presetRange(preset: RangePreset): { from: string; to: string } | null {
  const to = todayIso();
  switch (preset) {
    case '7d':
      return { from: daysAgoIso(6), to };
    case '30d':
      return { from: daysAgoIso(29), to };
    case '90d':
      return { from: daysAgoIso(89), to };
    case 'custom':
      return null;
  }
}

function previousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));

  return { prevFrom: toIsoDate(prevFrom), prevTo: toIsoDate(prevTo) };
}

function computeDelta(current: number, previous: number): StatDelta | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return undefined;
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  const abs = Math.abs(pct);
  if (abs < 0.5) return { value: `${pct.toFixed(1)}%`, direction: 'flat' };
  return {
    value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === 'Admin';
  const isBranchManager = currentUser?.role === 'Branch Manager';
  const isAllowed = isAdmin || isBranchManager;

  const from = parseDate(searchParams.get('from'), daysAgoIso(6));
  const to = parseDate(searchParams.get('to'), todayIso());
  const branchParam = parseId(searchParams.get('branchId'));

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const effectiveBranchId = isBranchManager ? currentUser?.branchId : branchParam;

  const { prevFrom, prevTo } = useMemo(() => previousPeriod(from, to), [from, to]);

  const branches = useBranchNames(isAdmin);

  const appointments = useAsync<AppointmentSummaryReportItem[]>(
    () =>
      isAllowed
        ? fetchAppointmentsSummary({ branchId: effectiveBranchId, from, to })
        : Promise.resolve([]),
    [isAllowed, effectiveBranchId, from, to],
  );
  const prevAppointments = useAsync<AppointmentSummaryReportItem[]>(
    () =>
      isAllowed
        ? fetchAppointmentsSummary({ branchId: effectiveBranchId, from: prevFrom, to: prevTo })
        : Promise.resolve([]),
    [isAllowed, effectiveBranchId, prevFrom, prevTo],
  );

  const revenue = useAsync<DoctorRevenueReportItem[]>(
    () =>
      isAllowed
        ? fetchDoctorRevenue({ branchId: effectiveBranchId, from, to })
        : Promise.resolve([]),
    [isAllowed, effectiveBranchId, from, to],
  );
  const prevRevenue = useAsync<DoctorRevenueReportItem[]>(
    () =>
      isAllowed
        ? fetchDoctorRevenue({ branchId: effectiveBranchId, from: prevFrom, to: prevTo })
        : Promise.resolve([]),
    [isAllowed, effectiveBranchId, prevFrom, prevTo],
  );

  const outstanding = useAsync<OutstandingBalanceReportItem[]>(
    () =>
      isAllowed
        ? fetchOutstandingBalances({ branchId: effectiveBranchId })
        : Promise.resolve([]),
    [isAllowed, effectiveBranchId],
  );

  const insurance = useAsync<InsuranceVsOutOfPocketReport | null>(
    () =>
      isAllowed
        ? fetchInsuranceVsOutOfPocket({ branchId: effectiveBranchId, from, to })
        : Promise.resolve(null),
    [isAllowed, effectiveBranchId, from, to],
  );

  const showBranchesChart = isAdmin && effectiveBranchId === undefined;

  const preset = detectPreset(from, to);

  const branchOptions = useMemo(() => {
    const opts = [{ label: 'All branches', value: '' }];
    for (const b of branches.branches) {
      opts.push({ label: b.branchName, value: String(b.branchId) });
    }
    return opts;
  }, [branches.branches]);

  const apptTotals = useMemo(() => {
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    for (const row of appointments.data ?? []) {
      total += row.totalCount;
      completed += row.completedCount;
      cancelled += row.cancelledCount;
    }
    return { total, completed, cancelled };
  }, [appointments.data]);

  const prevApptTotal = useMemo(
    () => (prevAppointments.data ?? []).reduce((s, r) => s + r.totalCount, 0),
    [prevAppointments.data],
  );

  const revenueTotal = useMemo(
    () => (revenue.data ?? []).reduce((s, r) => s + r.revenue, 0),
    [revenue.data],
  );
  const prevRevenueTotal = useMemo(
    () => (prevRevenue.data ?? []).reduce((s, r) => s + r.revenue, 0),
    [prevRevenue.data],
  );

  const outstandingTotals = useMemo(() => {
    let amount = 0;
    for (const row of outstanding.data ?? []) amount += row.outstandingAmount;
    return { amount, count: (outstanding.data ?? []).length };
  }, [outstanding.data]);

  const insuranceShare =
    insurance.data && insurance.data.subtotalAmount > 0
      ? (insurance.data.insuranceAmount / insurance.data.subtotalAmount) * 100
      : 0;

  const completionRate =
    apptTotals.total > 0 ? (apptTotals.completed / apptTotals.total) * 100 : 0;

  const apptDelta = computeDelta(apptTotals.total, prevApptTotal);
  const revenueDelta = computeDelta(revenueTotal, prevRevenueTotal);

  const reportUrl = useCallback(
    (tab: string) => {
      const params = new URLSearchParams();
      params.set('tab', tab);
      params.set('from', from);
      params.set('to', to);
      if (effectiveBranchId !== undefined) params.set('branchId', String(effectiveBranchId));
      return `/reports?${params.toString()}`;
    },
    [from, to, effectiveBranchId],
  );

  const chips: AttentionChip[] = useMemo(() => {
    const list: AttentionChip[] = [];

    if (apptTotals.total > 0) {
      const rate = apptTotals.cancelled / apptTotals.total;
      if (rate >= ALERT_THRESHOLDS.CANCELLATION_RATE) {
        list.push({
          id: 'cancellations',
          tone: 'warning',
          icon: 'warning',
          label: 'Cancellations',
          value: formatPercent(rate * 100, 0),
          onSelect: () => navigate(reportUrl('appointments')),
        });
      }
    }

    const overCount =
      outstandingTotals.count >= ALERT_THRESHOLDS.OUTSTANDING_BALANCE_COUNT;
    const overAmount =
      outstandingTotals.amount >= ALERT_THRESHOLDS.OUTSTANDING_BALANCE_AMOUNT;
    if (overCount || overAmount) {
      list.push({
        id: 'outstanding',
        tone: overAmount ? 'error' : 'warning',
        icon: overAmount ? 'error' : 'warning',
        label: 'Outstanding',
        value: formatCurrency(outstandingTotals.amount),
        onSelect: () => navigate(reportUrl('outstanding')),
      });
    }

    return list.slice(0, 3);
  }, [apptTotals, outstandingTotals, navigate, reportUrl]);

  const isRefreshing =
    appointments.isLoading ||
    prevAppointments.isLoading ||
    revenue.isLoading ||
    prevRevenue.isLoading ||
    outstanding.isLoading ||
    insurance.isLoading;

  const reloadAll = useCallback(() => {
    appointments.reload();
    prevAppointments.reload();
    revenue.reload();
    prevRevenue.reload();
    outstanding.reload();
    insurance.reload();
    branches.reload();
  }, [
    appointments.reload,
    prevAppointments.reload,
    revenue.reload,
    prevRevenue.reload,
    outstanding.reload,
    insurance.reload,
    branches.reload,
  ]);

  const kpiItems: DashboardKpiItem[] = [
    {
      key: 'appointments',
      label: 'Appointments',
      icon: 'event_note',
      value: appointments.data ? apptTotals.total.toLocaleString() : '',
      description:
        apptTotals.total > 0
          ? `Completion rate ${formatPercent(completionRate, 0)}`
          : undefined,
      delta: apptDelta,
      loading: appointments.isLoading,
      hasData: appointments.data !== undefined,
      error: appointments.error,
      onClick: () => navigate(reportUrl('appointments')),
      onRetry: appointments.reload,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      icon: 'payments',
      value: revenue.data ? formatCurrency(revenueTotal) : '',
      delta: revenueDelta,
      loading: revenue.isLoading,
      hasData: revenue.data !== undefined,
      error: revenue.error,
      onClick: () => navigate(reportUrl('doctor-revenue')),
      onRetry: revenue.reload,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      icon: 'account_balance_wallet',
      value: outstanding.data ? formatCurrency(outstandingTotals.amount) : '',
      description: outstanding.data
        ? `${outstandingTotals.count.toLocaleString()} invoices`
        : undefined,
      loading: outstanding.isLoading,
      hasData: outstanding.data !== undefined,
      error: outstanding.error,
      onClick: () => navigate(reportUrl('outstanding')),
      onRetry: outstanding.reload,
    },
    {
      key: 'insurance',
      label: 'Insurance share',
      icon: 'health_and_safety',
      value: insurance.data ? formatPercent(insuranceShare, 1) : '',
      description: insurance.data
        ? formatCurrency(insurance.data.insuranceAmount)
        : undefined,
      loading: insurance.isLoading,
      hasData: insurance.data !== null && insurance.data !== undefined,
      error: insurance.error,
      onClick: () => navigate(reportUrl('insurance')),
      onRetry: insurance.reload,
    },
  ];

  if (!isAllowed) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Access restricted" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Dashboard"
        actions={
          <DashboardFilters
            preset={preset}
            onPresetChange={(next) => {
              const range = presetRange(next);
              if (range) updateParams({ from: range.from, to: range.to });
            }}
            from={from}
            to={to}
            onFromChange={(iso) => {
              if (!iso) return;
              const nextTo = iso > to ? iso : to;
              updateParams({ from: iso, to: nextTo });
            }}
            onToChange={(iso) => {
              if (!iso) return;
              const nextFrom = iso < from ? iso : from;
              updateParams({ from: nextFrom, to: iso });
            }}
            showBranchSelect={isAdmin}
            branchValue={branchParam !== undefined ? String(branchParam) : ''}
            branchOptions={branchOptions}
            onBranchChange={(value) => updateParams({ branchId: value || null })}
            onRefresh={reloadAll}
            isRefreshing={isRefreshing}
          />
        }
      />

      <DashboardAttention chips={chips} />

      <DashboardKpis items={kpiItems} />

      <DashboardCharts
        appointments={appointments.data ?? []}
        appointmentsLoading={appointments.isLoading}
        appointmentsError={appointments.error}
        appointmentsRetry={appointments.reload}
        revenue={revenue.data ?? []}
        revenueLoading={revenue.isLoading}
        revenueError={revenue.error}
        revenueRetry={revenue.reload}
        insurance={insurance.data ?? null}
        insuranceLoading={insurance.isLoading}
        insuranceError={insurance.error}
        insuranceRetry={insurance.reload}
        branchRevenue={showBranchesChart ? (revenue.data ?? []) : []}
        branchRevenueLoading={showBranchesChart ? revenue.isLoading : false}
        branchRevenueError={showBranchesChart ? revenue.error : null}
        branchRevenueRetry={revenue.reload}
        showBranchesChart={showBranchesChart}
        onViewAppointmentsReport={() => navigate(reportUrl('appointments'))}
        onViewRevenueReport={() => navigate(reportUrl('doctor-revenue'))}
        onViewInsuranceReport={() => navigate(reportUrl('insurance'))}
        onViewBranchesReport={() => navigate(reportUrl('doctor-revenue'))}
      />
    </div>
  );
}
