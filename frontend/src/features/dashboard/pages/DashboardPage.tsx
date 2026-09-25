import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { IconButton } from '../../../components/ui/IconButton';
import { KpiCard } from '../components/KpiCard';
import { mockAppointments } from '../../../services/mock/appointments';
import { formatTime } from '../../../utils/formatters';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { ROUTES } from '../../../constants/routes';

export function DashboardPage() {
  const navigate = useNavigate();

  const openConsultation = (appointmentId: number) => {
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-display-sm text-on-surface">Admin Dashboard</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Overview for All Branches</p>
        </div>
        <Button variant="primary" icon="add" onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}>
          New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-element-gap">
        <KpiCard
          label="Today's Appointments"
          value={String(mockAppointments.length)}
          icon="calendar_month"
          iconTone="primary"
          trend="+12%"
        />
        <KpiCard
          label="Outstanding Dues"
          value="$12,450"
          icon="payments"
          iconTone="error"
          helperText="Across 3 branches"
        />
        <KpiCard
          label="Active Staff"
          value="18"
          icon="medical_services"
          iconTone="secondary"
          helperText="On duty today"
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="text-headline-sm text-on-surface">Recent Appointments</h3>
          <button
            onClick={() => navigate(ROUTES.APPOINTMENTS)}
            className="text-primary text-label-md hover:underline flex items-center gap-1"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-bright">
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">
                  Patient
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">
                  Time
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">
                  Branch
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">
                  Status
                </th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {mockAppointments.map((appointment) => (
                <tr
                  key={appointment.appointmentId}
                  onClick={() => openConsultation(appointment.appointmentId)}
                  className="border-b border-outline-variant hover:bg-[#EDF2F7] cursor-pointer transition-colors group"
                >
                  <td className="p-table-cell-padding font-medium text-on-surface">
                    {appointment.patientName}
                  </td>
                  <td className="p-table-cell-padding text-on-surface-variant">
                    {formatTime(appointment.appointmentTime)} · Today
                  </td>
                  <td className="p-table-cell-padding text-on-surface-variant">
                    {appointment.branchName}
                  </td>
                  <td className="p-table-cell-padding">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
                      {appointment.status}
                    </Badge>
                  </td>
                  <td className="p-table-cell-padding text-right">
                    <IconButton
                      icon="edit"
                      aria-label={`Edit appointment for ${appointment.patientName}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openConsultation(appointment.appointmentId);
                      }}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
