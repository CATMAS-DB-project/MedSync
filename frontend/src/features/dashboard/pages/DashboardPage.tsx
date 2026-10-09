import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchBranches } from '../../../services/api/branches';
import { todayIso } from '../../../utils/dates';
import { ROUTES } from '../../../constants/routes';
import { DateRangeControl, daysAgoIso, type DateRange } from '../components/DateRangeControl';
import { KpiRow } from '../components/KpiRow';
import { TrendCard } from '../components/TrendCard';
import { AlertsPanel } from '../components/AlertsPanel';
import { BranchComparison } from '../components/BranchComparison';
import { TodaySchedule } from '../components/TodaySchedule';

export function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  const isAdmin = role === 'Admin';
  const isBranchManager = role === 'Branch Manager';
  const canViewReports = isAdmin || isBranchManager;
  const canBook = isAdmin || isBranchManager;

  const [branchSelection, setBranchSelection] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: daysAgoIso(6),
    to: todayIso(),
  }));

  const branches = useAsync(() => fetchBranches(1, 100), []);

  // Branch Managers are locked to their own branch
  const branchId = isBranchManager
    ? currentUser?.branchId
    : branchSelection === 'all'
      ? undefined
      : Number(branchSelection);

  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({
      label: b.branchName,
      value: String(b.branchId),
    })),
  ];

  const scopeLabel = isBranchManager
    ? (branches.data?.items.find((b) => b.branchId === branchId)?.branchName ?? 'Assigned branch')
    : branchId === undefined
      ? 'All branches'
      : (branches.data?.items.find((b) => b.branchId === branchId)?.branchName ?? 'Selected branch');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">dashboard</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Clinic overview</p>
            <h2 className="text-display-sm text-white">Dashboard</h2>
            <p className="mt-1 text-body-sm text-white/80">Overview for {scopeLabel}</p>
          </div>
        </div>
        <div className="relative z-10 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isAdmin && (
            <div className="w-full rounded-lg border border-white/20 bg-white/10 p-2 sm:w-52">
              <label htmlFor="dashboard-branch-select" className="mb-1 block text-label-md text-white">
                Branch
              </label>
              <Select
                id="dashboard-branch-select"
                options={branchOptions}
                value={branchSelection}
                onChange={(e) => setBranchSelection(e.target.value)}
              />
            </div>
          )}
          {canBook && (
            <Button
              variant="primary"
              icon="add"
              onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}
              className="w-full bg-white text-primary shadow-lg hover:bg-secondary hover:text-on-secondary sm:w-auto"
            >
              New Appointment
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Control (for report/trend sections) */}
      {canViewReports && (
        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">date_range</span>
              </span>
              <div>
                <h3 className="text-body-md font-semibold text-on-surface">Reporting period</h3>
                <p className="text-body-sm text-on-surface-variant">Trends, revenue, and alerts</p>
              </div>
            </div>
            <DateRangeControl value={dateRange} onChange={setDateRange} />
          </div>
        </section>
      )}

      {/* KPI Section */}
      {canViewReports ? (
        <KpiRow branchId={branchId} dateRange={dateRange} />
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          <EmptyState
            title="Operational metrics not available"
            description="KPI reporting metrics are restricted to administrative and management personnel."
            icon="analytics"
          />
        </div>
      )}

      {/* Trends Section */}
      {canViewReports ? (
        <TrendCard branchId={branchId} dateRange={dateRange} />
      ) : null}

      {/* Alerts Section */}
      {canViewReports ? (
        <AlertsPanel branchId={branchId} dateRange={dateRange} />
      ) : null}

      {/* Admin Only: Branch Comparison */}
      {isAdmin && (
        <BranchComparison dateRange={dateRange} />
      )}

      {/* Today's Schedule Table */}
      <TodaySchedule branchId={branchId} />
    </div>
  );
}
