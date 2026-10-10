import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { TableSkeleton } from '../../../components/common/TableSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { formatTime } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { ROUTES } from '../../../constants/routes';

interface TodayScheduleProps {
  branchId?: number;
}

export function TodaySchedule({ branchId }: TodayScheduleProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  // Admin can open the consultation screen; Branch Manager and others cannot.
  const canOpenConsultation = role === 'Admin';
  const isQaTester = role === 'QA Tester';

  const today = todayIso();

  const todays = useAsync(
    () => {
      if (isQaTester) {
        // QA Tester is not allowed to query appointments per backend RBAC
        return Promise.resolve({ total: 0, items: [], page: 1, pageSize: 50 });
      }
      return fetchAppointments({ branchId, date: today, pageSize: 50 });
    },
    [branchId, today, isQaTester],
  );

  const rows = todays.data?.items ?? [];

  const openConsultation = (appointmentId: number) => {
    if (!canOpenConsultation) return;
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-headline-sm text-on-surface">Today&apos;s Appointments</h3>
          <p className="text-body-sm text-on-surface-variant">Live appointment queue for today</p>
        </div>
        {!isQaTester && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.APPOINTMENTS)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-label-md font-medium text-primary transition-colors hover:bg-primary-fixed/40 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View All
          </button>
        )}
      </div>

      {todays.error && (
        <div className="p-4">
          <ErrorBanner message={todays.error} onRetry={todays.reload} />
        </div>
      )}

      {todays.isLoading && rows.length === 0 ? (
        <div className="p-4">
          <TableSkeleton rows={4} columns={5} />
        </div>
      ) : isQaTester ? (
        <div className="p-6">
          <EmptyState
            title="Appointment queue restricted"
            description="The live appointment schedule is reserved for clinical, reception, and branch management roles."
            icon="lock"
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No appointments scheduled for today"
            description="The queue is clear for the selected branch filter."
            icon="event_available"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant bg-primary-fixed/20">
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
                  className={`border-b border-outline-variant odd:bg-surface-container-lowest even:bg-secondary-fixed/10 hover:bg-primary-fixed/25 transition-colors ${
                    canOpenConsultation ? 'cursor-pointer' : ''
                  }`}
                  title={canOpenConsultation ? 'Click to open consultation' : undefined}
                >
                  <td className="p-table-cell-padding font-semibold text-on-surface">
                    {appointment.patientName}
                  </td>
                  <td className="p-table-cell-padding text-on-surface-variant">
                    {formatTime(appointment.appointmentTime)}
                  </td>
                  <td className="p-table-cell-padding text-on-surface-variant">
                    {appointment.doctorName}
                  </td>
                  <td className="p-table-cell-padding text-on-surface-variant">
                    {appointment.branchName}
                  </td>
                  <td className="p-table-cell-padding">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
                      {appointment.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
