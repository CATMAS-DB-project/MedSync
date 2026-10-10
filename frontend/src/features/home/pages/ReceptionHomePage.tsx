import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { PatientDetailDrawer } from '../../patients/components/PatientDetailDrawer';
import { CancelAppointmentDrawer } from '../../appointments/components/CancelAppointmentDrawer';
import { InvoiceDetailDrawer } from '../../billing/components/InvoiceDetailDrawer';
import { ReceptionPatientSearch } from '../components/ReceptionPatientSearch';
import { ReceptionQueueCard } from '../components/ReceptionQueueCard';
import { ReceptionBillingCard } from '../components/ReceptionBillingCard';
import type { BillingTab } from '../components/ReceptionBillingCard';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import { fetchInvoices } from '../../../services/api/invoices';
import { fetchOutstandingBalances } from '../../../services/api/reports';
import type { OutstandingBalanceReportItem } from '../../../services/api/reports';
import { ROUTES } from '../../../constants/routes';
import { formatDate } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import type { Appointment, Invoice } from '../../../types';

const AUTO_REFRESH_MS = 60_000;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface StatViewProps {
  label: string;
  value: string;
  icon: string;
  description?: ReactNode;
  isLoading: boolean;
  hasData: boolean;
  error: string | null;
  onRetry: () => void;
  onClick: () => void;
}

function StatView({
  label,
  value,
  icon,
  description,
  isLoading,
  hasData,
  error,
  onRetry,
  onClick,
}: StatViewProps) {
  if (isLoading && !hasData) {
    return <Skeleton height={116} rounded="xl" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
        <div className="flex flex-col gap-1">
          <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
            {label}
          </span>
          <span className="text-display-sm text-on-surface-variant">—</span>
        </div>
        <IconButton
          icon="refresh"
          size="sm"
          aria-label={`Retry ${label}`}
          onClick={onRetry}
        />
      </div>
    );
  }

  return (
    <StatCard
      label={label}
      value={value}
      icon={icon}
      description={description}
      onClick={onClick}
    />
  );
}

export function ReceptionHomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const today = todayIso();

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedCancel, setSelectedCancel] = useState<Appointment | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const branchId = currentUser?.branchId;

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const branchName =
    branches.data?.items.find((branch) => branch.branchId === branchId)?.branchName ??
    'Current branch';

  const appointmentsToday = useAsync(
    () =>
      branchId
        ? fetchAppointments({ branchId, date: today, page: 1, pageSize: 50 })
        : Promise.resolve({ total: 0, items: [] as Appointment[] }),
    [branchId, today],
  );

  const draftInvoices = useAsync(
    () =>
      branchId
        ? fetchInvoices({ branchId, status: 'Draft', page: 1, pageSize: 5 })
        : Promise.resolve({ total: 0, items: [] as Invoice[] }),
    [branchId],
  );

  const outstandingBalances = useAsync(
    () =>
      branchId
        ? fetchOutstandingBalances({ branchId })
        : Promise.resolve([] as OutstandingBalanceReportItem[]),
    [branchId],
  );

  const reloadAppointments = appointmentsToday.reload;
  const reloadDrafts = draftInvoices.reload;
  const reloadBalances = outstandingBalances.reload;

  useEffect(() => {
    if (appointmentsToday.data) setLastUpdated(new Date());
  }, [appointmentsToday.data]);

  const refreshAll = useCallback(() => {
    reloadAppointments();
    reloadDrafts();
    reloadBalances();
  }, [reloadAppointments, reloadDrafts, reloadBalances]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    const interval = window.setInterval(tick, AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshAll]);

  const todayQueue = appointmentsToday.data?.items ?? [];

  const queueCounts = useMemo(() => {
    const scheduled = todayQueue.filter((a) => a.status === 'Scheduled').length;
    const completed = todayQueue.filter((a) => a.status === 'Completed').length;
    const cancelled = todayQueue.filter((a) => a.status === 'Cancelled').length;
    return { scheduled, completed, cancelled };
  }, [todayQueue]);

  const oldestDrafts = useMemo(() => {
    const drafts = draftInvoices.data?.items ?? [];
    return [...drafts]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      })
      .slice(0, 5);
  }, [draftInvoices.data]);

  const balanceDueList = useMemo(
    () =>
      (outstandingBalances.data ?? [])
        .filter((item) => item.outstandingAmount > 0)
        .slice(0, 5),
    [outstandingBalances.data],
  );

  const balanceDueCount = useMemo(
    () =>
      (outstandingBalances.data ?? []).filter((item) => item.outstandingAmount > 0)
        .length,
    [outstandingBalances.data],
  );

  const openTodayAppointments = () => {
    if (!branchId) return;
    navigate(`${ROUTES.APPOINTMENTS}?date=${today}&branchId=${branchId}`);
  };

  const openDraftBilling = () => {
    if (!branchId) return;
    navigate(`${ROUTES.BILLING}?status=Draft&branchId=${branchId}`);
  };

  const openDueBilling = () => {
    if (!branchId) return;
    navigate(`${ROUTES.BILLING}?status=Partially%20Paid&branchId=${branchId}`);
  };

  const handleViewAllBilling = (tab: BillingTab) => {
    if (tab === 'Drafts') {
      openDraftBilling();
    } else {
      openDueBilling();
    }
  };

  if (!currentUser || currentUser.role !== 'Receptionist') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState
          icon="lock"
          title="Access restricted to reception staff"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-sm text-on-surface">
            {getGreeting()}, {currentUser.firstName || 'Receptionist'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" pill>
              <Icon name="today" size={12} />
              {formatDate(today)}
            </Badge>
            <Badge tone="neutral" pill>
              <Icon name="location_on" size={12} />
              {branchName}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            icon="person_add"
            onClick={() => navigate(`${ROUTES.PATIENTS}?new=1`)}
          >
            Register patient
          </Button>
          <Button
            variant="secondary"
            icon="add"
            onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}
          >
            New appointment
          </Button>
          <Button
            variant="secondary"
            icon="directions_walk"
            onClick={() => navigate(ROUTES.WALK_IN)}
          >
            Walk-in
          </Button>
        </div>
      </header>

      {/* Patient search */}
      <ReceptionPatientSearch onSelectPatient={setSelectedPatientId} />

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-3">
        <StatView
          label="Appointments today"
          value={String(appointmentsToday.data?.total ?? 0)}
          icon="event"
          description={
            <>
              {queueCounts.scheduled} scheduled · {queueCounts.completed} completed ·{' '}
              {queueCounts.cancelled} cancelled
            </>
          }
          isLoading={appointmentsToday.isLoading}
          hasData={appointmentsToday.data !== undefined}
          error={appointmentsToday.error}
          onRetry={reloadAppointments}
          onClick={openTodayAppointments}
        />

        <StatView
          label="Draft invoices"
          value={String(draftInvoices.data?.total ?? 0)}
          icon="receipt_long"
          isLoading={draftInvoices.isLoading}
          hasData={draftInvoices.data !== undefined}
          error={draftInvoices.error}
          onRetry={reloadDrafts}
          onClick={openDraftBilling}
        />

        <StatView
          label="Balance due"
          value={String(balanceDueCount)}
          icon="account_balance_wallet"
          isLoading={outstandingBalances.isLoading}
          hasData={outstandingBalances.data !== undefined}
          error={outstandingBalances.error}
          onRetry={reloadBalances}
          onClick={openDueBilling}
        />
      </section>

      {/* Queue + Billing */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReceptionQueueCard
            appointments={todayQueue}
            isLoading={appointmentsToday.isLoading}
            error={appointmentsToday.error}
            onRetry={reloadAppointments}
            onRefresh={refreshAll}
            lastUpdated={lastUpdated}
            onViewPatient={setSelectedPatientId}
            onCancel={setSelectedCancel}
          />
        </div>
        <div className="lg:col-span-1">
          <ReceptionBillingCard
            drafts={oldestDrafts}
            draftsLoading={draftInvoices.isLoading}
            draftsError={draftInvoices.error}
            onDraftsRetry={reloadDrafts}
            balances={balanceDueList}
            balancesLoading={outstandingBalances.isLoading}
            balancesError={outstandingBalances.error}
            onBalancesRetry={reloadBalances}
            onViewInvoice={setSelectedInvoiceId}
            onViewAll={handleViewAllBilling}
          />
        </div>
      </section>

      {/* Drawers */}
      <PatientDetailDrawer
        patientId={selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
      />
      <CancelAppointmentDrawer
        appointment={selectedCancel}
        onClose={() => setSelectedCancel(null)}
        onCancelled={() => {
          reloadAppointments();
          reloadBalances();
        }}
      />
      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onChanged={() => {
          reloadDrafts();
          reloadBalances();
        }}
      />
    </div>
  );
}
