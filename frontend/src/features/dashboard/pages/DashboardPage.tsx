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
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Dashboard</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Overview for {scopeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <div className="w-48">
              <Select
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
            >
              New Appointment
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Control (for report/trend sections) */}
      {canViewReports && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-outline-variant pb-4">
          <DateRangeControl value={dateRange} onChange={setDateRange} />
          <span className="text-label-md text-on-surface-variant">
            Data window for Trends, Revenue &amp; Alerts
          </span>
        </div>
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
