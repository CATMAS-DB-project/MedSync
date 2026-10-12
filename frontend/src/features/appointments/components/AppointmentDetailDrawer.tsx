import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { formatDate, formatTime } from '../../../utils/formatters';
import { APPOINTMENT_STATUS_TONE } from '../statusStyles';
import type { Appointment, Role } from '../../../types';

export interface AppointmentDetailDrawerProps {
  appointment: Appointment | null;
  role: Role | undefined;
  onClose: () => void;
  onViewPatient: (patientId: number) => void;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
  onOpenConsultation?: (appointmentId: number) => void;
}

export function AppointmentDetailDrawer({
  appointment,
  role,
  onClose,
  onViewPatient,
  onReschedule,
  onCancel,
  onOpenConsultation,
}: AppointmentDetailDrawerProps) {
  const isOpen = appointment !== null;

  const isReceptionist = role === 'Receptionist';
  const isDoctor = role === 'Doctor';
  const isAdmin = role === 'Admin';
  const canRescheduleOrCancel =
    isReceptionist &&
    (appointment?.status === 'Scheduled' || appointment?.status === 'Re-Scheduled');
  const canOpenConsultation =
    (isDoctor || isAdmin) &&
    appointment !== null &&
    appointment.status !== 'Cancelled';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        appointment
          ? `Appointment #${appointment.appointmentId}`
          : 'Appointment'
      }
      subtitle={
        appointment
          ? `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {appointment && canOpenConsultation && onOpenConsultation && (
            <Button
              variant="primary"
              icon="clinical_notes"
              onClick={() => {
                onClose();
                onOpenConsultation(appointment.appointmentId);
              }}
            >
              {isDoctor ? 'Open consultation' : 'View consultation'}
            </Button>
          )}
          {appointment && canRescheduleOrCancel && onCancel && (
            <Button
              variant="danger"
              icon="event_busy"
              onClick={() => {
                const target = appointment;
                onClose();
                onCancel(target);
              }}
            >
              Cancel
            </Button>
          )}
          {appointment && canRescheduleOrCancel && onReschedule && (
            <Button
              variant="primary"
              icon="event_repeat"
              onClick={() => {
                const target = appointment;
                onClose();
                onReschedule(target);
              }}
            >
              Reschedule
            </Button>
          )}
        </>
      }
    >
      {appointment && (
        <>
          {/* Patient summary card */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={appointment.patientName ?? 'Patient'} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-headline-sm text-on-surface">
                  {appointment.patientName ?? `Patient #${appointment.patientId}`}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]} dot pill>
                    {appointment.status}
                  </Badge>
                  {appointment.isWalkIn && (
                    <Badge tone="secondary" pill>
                      Walk-in
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="person"
              onClick={() => {
                const pid = appointment.patientId;
                onClose();
                onViewPatient(pid);
              }}
            >
              Patient profile
            </Button>
          </div>

          {/* Quick Actions Banner for Receptionist on Scheduled Appointments */}
          {canRescheduleOrCancel && (onReschedule || onCancel) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-container/20 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-body-sm font-semibold text-on-surface">
                  Manage booking
                </span>
                <span className="text-label-md text-on-surface-variant">
                  Move this visit to another slot or cancel it
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onReschedule && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="event_repeat"
                    onClick={() => {
                      const target = appointment;
                      onClose();
                      onReschedule(target);
                    }}
                  >
                    Reschedule
                  </Button>
                )}
                {onCancel && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon="event_busy"
                    onClick={() => {
                      const target = appointment;
                      onClose();
                      onCancel(target);
                    }}
                  >
                    Cancel appointment
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Visit Details */}
          <DrawerSection title="Visit details" icon="event">
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <DetailRow label="Appointment ID" value={`#${appointment.appointmentId}`} />
              <DetailRow label="Date" value={formatDate(appointment.appointmentDate)} />
              <DetailRow label="Time" value={formatTime(appointment.appointmentTime)} />
              <DetailRow label="Doctor" value={appointment.doctorName ?? '—'} />
              {appointment.branchName && (
                <DetailRow label="Branch" value={appointment.branchName} />
              )}
              <DetailRow label="Booked on" value={formatDate(appointment.createdAt)} />
              {appointment.previousAppointmentId && (
                <DetailRow
                  label="Rescheduled from"
                  value={`Visit #${appointment.previousAppointmentId}`}
                />
              )}
            </div>
          </DrawerSection>

          {/* Cancel / Reschedule Reason */}
          {appointment.cancelRescheduleReason && (
            <DrawerSection title="Reason / note" icon="notes">
              <div className="flex items-start gap-2.5 rounded-2xl bg-surface-container-lowest p-4 text-body-sm text-on-surface shadow-card">
                <Icon
                  name="info"
                  size={18}
                  className="mt-0.5 shrink-0 text-on-surface-variant"
                />
                <span>{appointment.cancelRescheduleReason}</span>
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-label-md text-on-surface-variant">{label}</span>
      <span className="min-w-0 truncate text-right text-body-sm font-medium text-on-surface">
        {value}
      </span>
    </div>
  );
}

