import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { KpiCard } from '../components/KpiCard';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import {
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
  fetchOutstandingBalances,
} from '../../../services/api/reports';
import { formatCurrency, formatTime } from '../../../utils/formatters';
import { toIsoDate, todayIso } from '../../../utils/dates';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { ROUTES } from '../../../constants/routes';

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toIsoDate(date);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const isBranchManager = role === 'Branch Manager';
  // Only Admin can open the consultation screen (route rule); Branch Manager can only view.
  const canOpenConsultation = role === 'Admin';
  const canBook = role === 'Admin' || role === 'Branch Manager';

  const [branchSelection, setBranchSelection] = useState('all');
  const branches = useAsync(() => fetchBranches(1, 100), []);

  // Branch Managers are locked to their own branch by the backend.
  const branchId = isBranchManager
    ? currentUser?.branchId
    : branchSelection === 'all'
      ? undefined
      : Number(branchSelection);

  const today = todayIso();
  const weekStart = daysAgoIso(6);
  const monthStart = daysAgoIso(29);

  const summary = useAsync(
    () => fetchAppointmentsSummary({ branchId, from: weekStart, to: today }),
    [branchId, weekStart, today],
  );
  const outstanding = useAsync(() => fetchOutstandingBalances({ branchId }), [branchId]);
  const revenue = useAsync(
    () => fetchDoctorRevenue({ branchId, from: monthStart, to: today }),
    [branchId, monthStart, today],
  );
  const todays = useAsync(
    () => fetchAppointments({ branchId, date: today, pageSize: 8 }),
    [branchId, today],
  );

  const todayRow = summary.data?.find((row) => row.appointmentDate.slice(0, 10) === today);
  const outstandingTotal = (outstanding.data ?? []).reduce((sum, row) => sum + Number(row.outstandingAmount), 0);
  const revenueTotal = (revenue.data ?? []).reduce((sum, row) => sum + Number(row.revenue), 0);

  const bars = useMemo(() => {
    const byDate = new Map((summary.data ?? []).map((row) => [row.appointmentDate.slice(0, 10), row]));
    return Array.from({ length: 7 }, (_, i) => {
      const iso = daysAgoIso(6 - i);
      const row = byDate.get(iso);
      return {
        iso,
        label: new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        total: row?.totalCount ?? 0,
        completed: row?.completedCount ?? 0,
      };
    });
  }, [summary.data]);
  const maxBar = Math.max(1, ...bars.map((b) => b.total));

  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({ label: b.branchName, value: String(b.branchId) })),
  ];
  const scopeLabel = isBranchManager
    ? (branches.data?.items.find((b) => b.branchId === branchId)?.branchName ?? 'Your branch')
    : branchId === undefined
      ? 'All branches'
      : (branches.data?.items.find((b) => b.branchId === branchId)?.branchName ?? 'Selected branch');

  const kpi = (loading: boolean, error: string | null, value: string) =>
    error ? '—' : loading && value === '' ? '…' : value;

  const openConsultation = (appointmentId: number) =>
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));

  const rows = todays.data?.items ?? [];

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Dashboard</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Overview for {scopeLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isBranchManager && (
            <div className="w-48">
              <Select options={branchOptions} value={branchSelection} onChange={(e) => setBranchSelection(e.target.value)} />
            </div>
          )}
          {canBook && (
            <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}>
              New Appointment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-element-gap">
        <KpiCard
          label="Today's Appointments"
          value={kpi(summary.isLoading, summary.error, String(todayRow?.totalCount ?? (summary.data ? 0 : '')))}
          icon="calendar_month"
          iconTone="primary"
          helperText={
            summary.error
              ? 'Could not load'
              : `${todayRow?.scheduledCount ?? 0} scheduled · ${todayRow?.completedCount ?? 0} completed`
          }
        />
        <KpiCard
          label="Outstanding Dues"
          value={kpi(outstanding.isLoading, outstanding.error, outstanding.data ? formatCurrency(outstandingTotal) : '')}
          icon="payments"
          iconTone="error"
          helperText={outstanding.error ? 'Could not load' : `${outstanding.data?.length ?? 0} unpaid invoices`}
        />
        <KpiCard
          label="Revenue · Last 30 Days"
          value={kpi(revenue.isLoading, revenue.error, revenue.data ? formatCurrency(revenueTotal) : '')}
          icon="trending_up"
          iconTone="secondary"
          helperText={revenue.error ? 'Could not load' : 'After deductions and discounts'}
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
        <h3 className="text-headline-sm text-on-surface mb-4">Appointments · Last 7 Days</h3>
        {summary.error ? (
          <p className="text-body-sm text-error">{summary.error}</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {bars.map((bar) => (
              <div key={bar.iso} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <span className="text-label-md text-on-surface-variant">{bar.total}</span>
                <div
                  className="w-full rounded-t bg-primary-container"
                  style={{ height: `${(bar.total / maxBar) * 100}%`, minHeight: bar.total > 0 ? 4 : 0 }}
                  title={`${bar.completed} of ${bar.total} completed`}
                />
                <span className="text-label-md text-outline">{bar.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="text-headline-sm text-on-surface">Today&apos;s Appointments</h3>
          <button
            onClick={() => navigate(ROUTES.APPOINTMENTS)}
            className="text-primary text-label-md hover:underline flex items-center gap-1"
          >
            View All
          </button>
        </div>
        {todays.error && <p className="p-4 text-body-sm text-error">{todays.error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-bright">
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Patient</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Time</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Doctor</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Branch</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {rows.map((appointment) => (
                <tr
                  key={appointment.appointmentId}
                  onClick={canOpenConsultation ? () => openConsultation(appointment.appointmentId) : undefined}
                  className={`border-b border-outline-variant hover:bg-surface-container-high transition-colors ${
                    canOpenConsultation ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="p-table-cell-padding font-medium text-on-surface">{appointment.patientName}</td>
                  <td className="p-table-cell-padding text-on-surface-variant">{formatTime(appointment.appointmentTime)}</td>
                  <td className="p-table-cell-padding text-on-surface-variant">{appointment.doctorName}</td>
                  <td className="p-table-cell-padding text-on-surface-variant">{appointment.branchName}</td>
                  <td className="p-table-cell-padding">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                  </td>
                </tr>
              ))}
              {!todays.isLoading && !todays.error && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-on-surface-variant">
                    No appointments scheduled for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
