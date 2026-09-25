import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { mockAppointments } from '../../../services/mock/appointments';
import { formatDate, formatTime } from '../../../utils/formatters';
import { APPOINTMENT_STATUS_TONE } from '../statusStyles';
import { ROUTES } from '../../../constants/routes';
import type { AppointmentStatus } from '../../../types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { label: string; value: AppointmentStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

export function AppointmentsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const openConsultation = (appointmentId: number) => {
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };

  const filtered = useMemo(() => {
    return mockAppointments.filter((appointment) => {
      const matchesQuery =
        query.trim() === '' ||
        (appointment.patientName ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (appointment.doctorName ?? '').toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'all' || appointment.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Appointments</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Today's schedule across all branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon="how_to_reg" onClick={() => navigate(ROUTES.WALK_IN)}>
            New Walk-In
          </Button>
          <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}>
            New Appointment
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search by patient or doctor..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AppointmentStatus | 'all');
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Patient
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Doctor
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Date &amp; Time
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Branch
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Walk-in
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Status
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-16 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {paginated.map((appointment) => (
                <tr
                  key={appointment.appointmentId}
                  onClick={() => openConsultation(appointment.appointmentId)}
                  className="hover:bg-surface-container-high cursor-pointer transition-colors h-8 group"
                >
                  <td className="py-1.5 px-3 font-medium">{appointment.patientName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{appointment.doctorName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {formatDate(appointment.appointmentDate)} · {formatTime(appointment.appointmentTime)}
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{appointment.branchName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {appointment.isWalkIn ? 'Yes' : 'No'}
                  </td>
                  <td className="py-1.5 px-3">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
                      {appointment.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openConsultation(appointment.appointmentId);
                      }}
                      className="text-primary hover:text-primary-fixed-variant text-label-md px-2 py-1 border border-transparent hover:border-primary rounded transition-all opacity-0 group-hover:opacity-100"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    No appointments match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
