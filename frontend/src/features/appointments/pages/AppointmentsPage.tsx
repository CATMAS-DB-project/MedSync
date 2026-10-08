import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
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
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Appointments</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {date === todayIso() ? "Today's schedule" : date ? `Schedule for ${formatDate(date)}` : 'All dates'}
          </p>
        </div>
        {isReceptionist && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="how_to_reg" onClick={() => navigate(ROUTES.WALK_IN)}>
              New Walk-In
            </Button>
            <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}>
              New Appointment
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-48">
          <Input
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
          >
            All dates
          </Button>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        {appointments.error && (
          <div className="px-4 py-3 bg-error/10 text-error text-body-sm flex items-center justify-between">
            <span>{appointments.error}</span>
            <button type="button" className="underline" onClick={appointments.reload}>
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Patient</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Doctor</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Date &amp; Time</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Branch</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Walk-in</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Status</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-32 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {rows.map((appointment) => (
                <tr
                  key={appointment.appointmentId}
                  onClick={canOpenConsultation ? () => openConsultation(appointment.appointmentId) : undefined}
                  className={`hover:bg-surface-container-high transition-colors h-8 group ${
                    canOpenConsultation ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="py-1.5 px-3 font-medium">{appointment.patientName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{appointment.doctorName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {formatDate(appointment.appointmentDate)} · {formatTime(appointment.appointmentTime)}
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{appointment.branchName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{appointment.isWalkIn ? 'Yes' : 'No'}</td>
                  <td className="py-1.5 px-3">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                  </td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {canOpenConsultation && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openConsultation(appointment.appointmentId);
                        }}
                        className="text-primary hover:text-primary-fixed-variant text-label-md px-2 py-1 border border-transparent hover:border-primary rounded transition-all"
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
                        className="text-error text-label-md px-2 py-1 border border-transparent hover:border-error rounded transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!appointments.isLoading && !appointments.error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    No appointments found for these filters.
                  </td>
                </tr>
              )}
              {appointments.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    Loading appointments…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
      </div>

      <CancelAppointmentDrawer
        appointment={toCancel}
        onClose={closeCancel}
        onCancelled={appointments.reload}
      />
    </div>
  );
}
