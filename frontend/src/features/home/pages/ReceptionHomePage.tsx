import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { TableSkeleton } from '../../../components/common/TableSkeleton';
import { PatientDetailDrawer } from '../../patients/components/PatientDetailDrawer';
import { CancelAppointmentDrawer } from '../../appointments/components/CancelAppointmentDrawer';
import { InvoiceDetailDrawer } from '../../billing/components/InvoiceDetailDrawer';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import { fetchInvoices } from '../../../services/api/invoices';
import { fetchPatients } from '../../../services/api/patients';
import { ROUTES } from '../../../constants/routes';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { INVOICE_STATUS_TONE } from '../../billing/statusStyles';
import { formatCurrency, formatDate, formatFullName, formatTime, getInitials } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import type { Appointment, Invoice } from '../../../types';

function counterButtonClasses() {
  return 'w-full rounded-lg border border-outline-variant bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container-high';
}

export function ReceptionHomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const today = todayIso();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedCancel, setSelectedCancel] = useState<Appointment | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const branchId = currentUser?.branchId;

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const branchName =
    branches.data?.items.find((branch) => branch.branchId === branchId)?.branchName ?? 'Current branch';

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

  const balanceDueInvoices = useAsync(
    () =>
      branchId
        ? fetchInvoices({ branchId, page: 1, pageSize: 200 })
        : Promise.resolve({ total: 0, items: [] as Invoice[] }),
    [branchId],
  );

  const patientSearch = useAsync(
    () =>
      debouncedQuery.trim().length === 0
        ? Promise.resolve(null)
        : fetchPatients({ search: debouncedQuery, pageSize: 6 }),
    [debouncedQuery],
  );

  const todayQueue = useMemo(() => appointmentsToday.data?.items ?? [], [appointmentsToday.data]);
  const oldestDrafts = useMemo(() => {
    const drafts = draftInvoices.data?.items ?? [];
    return [...drafts].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    }).slice(0, 5);
  }, [draftInvoices.data]);

  const balanceDueCount = useMemo(
    () =>
      (balanceDueInvoices.data?.items ?? []).filter(
        (invoice) =>
          invoice.status !== 'Draft' &&
          invoice.status !== 'Paid' &&
          (invoice.outstandingAmount ?? 0) > 0,
      ).length,
    [balanceDueInvoices.data],
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

  if (!currentUser || currentUser.role !== 'Receptionist') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-display-sm text-on-surface">Reception Home</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">Access restricted to reception staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-6">
      <header className="mb-4 flex flex-col gap-3 border-b border-outline-variant pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-body-sm text-on-surface-variant">Reception dashboard</p>
          <h1 className="text-display-sm text-on-surface">
            Hello, {currentUser.firstName || 'Receptionist'}
          </h1>
        </div>
        <div className="flex flex-col items-start gap-1 text-body-sm text-on-surface-variant lg:items-end">
          <span>{formatDate(today)}</span>
          <span>{branchName}</span>
        </div>
      </header>

      <section className="mb-5 space-y-3">
        <div className="relative">
          <Input
            label="Find patient"
            icon="search"
            placeholder="Search by name, NIC or phone"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {debouncedQuery.trim() && patientSearch.data && patientSearch.data.items.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
              {patientSearch.data.items.map((patient) => (
                <button
                  key={patient.patientId}
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPatientId(patient.patientId);
                  }}
                  className="flex w-full items-center gap-3 border-b border-outline-variant px-3 py-2 text-left last:border-b-0 hover:bg-surface-container-high"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-[11px] font-bold text-on-secondary-container">
                    {getInitials(formatFullName(patient.firstName, patient.lastName))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-sm font-medium text-on-surface">
                      {formatFullName(patient.firstName, patient.lastName)}
                    </div>
                    <div className="text-label-md text-on-surface-variant">{patient.nicPassportNo}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {debouncedQuery.trim() && patientSearch.data && patientSearch.data.items.length === 0 && (
            <div className="mt-2 rounded border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
              No patient matches found.
            </div>
          )}
          {patientSearch.error && (
            <div className="mt-2">
              <ErrorBanner message={patientSearch.error} onRetry={patientSearch.reload} />
            </div>
          )}
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <button type="button" onClick={openTodayAppointments} className={counterButtonClasses()}>
          <div className="text-label-md text-on-surface-variant">Appointments today</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-display-sm text-on-surface">{appointmentsToday.data?.total ?? 0}</span>
            <span className="text-label-md text-primary">View</span>
          </div>
        </button>

        <button type="button" onClick={openDraftBilling} className={counterButtonClasses()}>
          <div className="text-label-md text-on-surface-variant">Draft invoices</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-display-sm text-on-surface">{draftInvoices.data?.total ?? 0}</span>
            <span className="text-label-md text-primary">Review</span>
          </div>
        </button>

        <button type="button" onClick={openDueBilling} className={counterButtonClasses()}>
          <div className="text-label-md text-on-surface-variant">Balance due</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-display-sm text-on-surface">{balanceDueCount}</span>
            <span className="text-label-md text-primary">Open</span>
          </div>
        </button>
      </section>

      <section className="mb-5 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 md:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-headline-sm text-on-surface">Today's queue</h2>
          <div className="flex gap-2">
            <Button variant="secondary" icon="how_to_reg" onClick={() => navigate(ROUTES.WALK_IN)}>
              New Walk-In
            </Button>
            <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}>
              New Appointment
            </Button>
          </div>
        </div>

        {appointmentsToday.error && (
          <ErrorBanner message={appointmentsToday.error} onRetry={appointmentsToday.reload} className="mb-3" />
        )}

        {appointmentsToday.isLoading && todayQueue.length === 0 ? (
          <TableSkeleton rows={4} columns={5} className="py-2" />
        ) : todayQueue.length === 0 ? (
          <EmptyState
            title="No appointments scheduled today."
            description="The queue is clear for the current branch."
            icon="event_available"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-body-sm">
              <thead className="border-b border-outline-variant bg-surface-container-low">
                <tr>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Patient</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Doctor</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Time</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Status</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {todayQueue.map((appointment) => (
                  <tr key={appointment.appointmentId} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-high">
                    <td className="px-2 py-2">
                      <div className="font-medium text-on-surface">{appointment.patientName}</div>
                    </td>
                    <td className="px-2 py-2 text-on-surface-variant">{appointment.doctorName}</td>
                    <td className="px-2 py-2 text-on-surface-variant">
                      {formatTime(appointment.appointmentTime)}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {appointment.status === 'Scheduled' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCancel(appointment)}
                          className="text-error hover:bg-error-container hover:text-on-error-container"
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-label-md text-on-surface-variant">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-headline-sm text-on-surface">Invoices to finalize</h2>
          <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.BILLING)}>
            View all
          </Button>
        </div>

        {draftInvoices.error && (
          <ErrorBanner message={draftInvoices.error} onRetry={draftInvoices.reload} className="mb-3" />
        )}

        {draftInvoices.isLoading && oldestDrafts.length === 0 ? (
          <TableSkeleton rows={3} columns={4} className="py-2" />
        ) : oldestDrafts.length === 0 ? (
          <EmptyState
            title="No draft invoices waiting."
            description="Everything is already finalized or paid for this branch."
            icon="receipt_long"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-body-sm">
              <thead className="border-b border-outline-variant bg-surface-container-low">
                <tr>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Invoice #</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Patient</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Amount</th>
                  <th className="px-2 py-2 text-label-md text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody>
                {oldestDrafts.map((invoice) => (
                  <tr
                    key={invoice.invoiceId}
                    className="cursor-pointer border-b border-outline-variant last:border-b-0 hover:bg-surface-container-high"
                    onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                  >
                    <td className="px-2 py-2 font-mono text-xs text-on-surface-variant">#{invoice.invoiceId}</td>
                    <td className="px-2 py-2 font-medium text-on-surface">
                      {invoice.patientName ?? `Patient #${invoice.patientId ?? '—'}`}
                    </td>
                    <td className="px-2 py-2 text-on-surface-variant">
                      {formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PatientDetailDrawer patientId={selectedPatientId} onClose={() => setSelectedPatientId(null)} />
      <CancelAppointmentDrawer
        appointment={selectedCancel}
        onClose={() => setSelectedCancel(null)}
        onCancelled={() => {
          appointmentsToday.reload();
          balanceDueInvoices.reload();
        }}
      />
      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onChanged={() => {
          draftInvoices.reload();
          balanceDueInvoices.reload();
        }}
      />
    </div>
  );
}
