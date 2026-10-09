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
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div>
          <h3 className="text-headline-sm text-on-surface">Today&apos;s Appointments</h3>
          <p className="text-body-sm text-on-surface-variant">Live appointment queue for today</p>
        </div>
        {!isQaTester && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.APPOINTMENTS)}
            className="text-primary text-label-md hover:underline flex items-center gap-1 font-medium"
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
                  title={canOpenConsultation ? 'Click to open consultation' : undefined}
                >
                  <td className="p-table-cell-padding font-medium text-on-surface">
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
