import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { PageSkeleton } from '../../../components/common/PageSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import { formatDate, formatTime } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import { APPOINTMENT_STATUS_TONE } from '../statusStyles';
import { CancelAppointmentDrawer } from '../components/CancelAppointmentDrawer';
import { ROUTES } from '../../../constants/routes';
import type { Appointment, AppointmentStatus } from '../../../types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { label: string; value: AppointmentStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'Re-Scheduled', value: 'Re-Scheduled' },
];

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  // Backend rules: only Receptionists book/cancel, only Doctors complete visits.
  const isReceptionist = role === 'Receptionist';
  const isDoctor = role === 'Doctor';
  // Frontend route rule: the consultation screen is for Admin and Doctor.
  const canOpenConsultation = role === 'Admin' || role === 'Doctor';

  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState<AppointmentStatus | 'all'>('all');
  const [branchId, setBranchId] = useState<string>(
    isReceptionist && currentUser ? String(currentUser.branchId) : 'all',
  );
  const [page, setPage] = useState(1);
  const [toCancel, setToCancel] = useState<Appointment | null>(null);

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const appointments = useAsync(
    () =>
      fetchAppointments({
        date: date || undefined,
        status: status === 'all' ? undefined : status,
        branchId: branchId === 'all' ? undefined : Number(branchId),
        // A doctor only sees their own schedule.
        doctorId: isDoctor && currentUser ? currentUser.staffId : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [date, status, branchId, page, isDoctor, currentUser?.staffId],
  );

  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({ label: b.branchName, value: String(b.branchId) })),
  ];

  const rows = appointments.data?.items ?? [];
  const total = appointments.data?.total ?? 0;

  const openConsultation = (appointmentId: number) => {
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };
  const closeCancel = useCallback(() => setToCancel(null), []);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated backdrop-blur-sm">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">calendar_month</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Care coordination</p>
            <h2 className="text-display-sm text-white">Appointments</h2>
            <p className="mt-1 text-body-sm text-white/80">
              {date === todayIso() ? "Today's schedule" : date ? `Schedule for ${formatDate(date)}` : 'All dates'}
            </p>
          </div>
        </div>
        {isReceptionist && (
          <div className="relative z-10 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              icon="how_to_reg"
              onClick={() => navigate(ROUTES.WALK_IN)}
              className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
            >
              New Walk-In
            </Button>
            <Button
              variant="primary"
              icon="add"
              onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}
              className="w-full bg-white text-primary shadow-lg hover:bg-secondary hover:text-on-secondary sm:w-auto"
            >
              New Appointment
            </Button>
          </div>
        )}
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
            </span>
            <div>
              <h3 className="text-body-md font-semibold text-on-surface">Schedule filters</h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Choose a date, status, or branch to refine appointments.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:w-48">
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AppointmentStatus | 'all');
                  setPage(1);
                }}
              />
            </div>
            {!isDoctor && (
              <div className="sm:w-56">
                <Select
                  label="Branch"
                  options={branchOptions}
                  value={branchId}
                  onChange={(event) => {
                    setBranchId(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}
            {date && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDate('');
                  setPage(1);
                }}
                className="h-9 self-start border border-outline-variant sm:self-auto"
              >
                All dates
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-headline-sm text-on-surface">Appointment directory</h3>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-md font-medium text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">event_available</span>
              {total.toLocaleString()} {total === 1 ? 'appointment' : 'appointments'} found
            </div>
          </div>
          {appointments.isLoading && <PageSkeleton className="w-24" />}
        </div>

        {appointments.error && (
          <div className="p-4">
            <ErrorBanner message={appointments.error} onRetry={appointments.reload} />
          </div>
        )}

        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-primary-fixed/30">
              <tr>
                <th scope="col" className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Patient</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Doctor</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Date &amp; Time</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Branch</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Visit type</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Status</th>
                <th scope="col" className="w-32 px-5 py-3 text-right text-label-md font-semibold text-on-surface-variant">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface">
              {appointments.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8">
                    <PageSkeleton className="space-y-4" />
                  </td>
                </tr>
              )}

              {!appointments.isLoading && !appointments.error && rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No appointments found for these filters."
                      description="Try another date, status, or branch selection."
                      icon="event_busy"
                    />
                  </td>
                </tr>
              )}

              {rows.map((appointment) => (
                <tr
                  key={appointment.appointmentId}
                  onClick={canOpenConsultation ? () => openConsultation(appointment.appointmentId) : undefined}
                  className={`group h-16 odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25 focus-within:bg-primary-fixed/25 ${
                    canOpenConsultation ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-semibold text-on-surface">{appointment.patientName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{appointment.doctorName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <div>{formatDate(appointment.appointmentDate)}</div>
                    <div className="mt-0.5 text-xs">{formatTime(appointment.appointmentTime)}</div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{appointment.branchName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {appointment.isWalkIn ? (
                      <Badge tone="secondary">Walk-in</Badge>
                    ) : (
                      <span className="text-on-surface-variant">Scheduled</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {canOpenConsultation && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openConsultation(appointment.appointmentId);
                        }}
                        className="rounded-md px-2 py-1 text-label-md font-medium text-primary transition-colors hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Open
                      </button>
                    )}
                    {isReceptionist && appointment.status === 'Scheduled' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setToCancel(appointment);
                        }}
                        className="rounded-md px-2 py-1 text-label-md font-medium text-error transition-colors hover:bg-error-container/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-outline-variant">
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
        </div>
      </section>

      <CancelAppointmentDrawer
        appointment={toCancel}
        onClose={closeCancel}
        onCancelled={appointments.reload}
      />
    </div>
  );
}
