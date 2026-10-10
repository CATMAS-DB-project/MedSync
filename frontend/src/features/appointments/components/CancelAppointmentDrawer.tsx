import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/layout/Drawer';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { TextArea } from '../../../components/ui/TextArea';
import { ApiError } from '../../../services/api/ApiError';
import { cancelAppointment } from '../../../services/api/appointments';
import { formatDate, formatTime } from '../../../utils/formatters';
import type { Appointment } from '../../../types';

export interface CancelAppointmentDrawerProps {
  appointment: Appointment | null;
  onClose: () => void;
  onCancelled: () => void;
}

export function CancelAppointmentDrawer({
  appointment,
  onClose,
  onCancelled,
}: CancelAppointmentDrawerProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason('');
    setError(null);
  }, [appointment]);

  async function handleConfirm() {
    if (!appointment) return;
    if (!reason.trim()) {
      setError('A cancellation reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await cancelAppointment(appointment.appointmentId, { reason: reason.trim() });
      onCancelled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      isOpen={appointment !== null}
      onClose={onClose}
      title="Cancel Appointment"
      subtitle={
        appointment
          ? `${appointment.patientName} · ${formatDate(appointment.appointmentDate)} ${formatTime(appointment.appointmentTime)}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep Appointment
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Cancelling…' : 'Cancel Appointment'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error-container/30 p-4">
          <span className="shrink-0 rounded-lg bg-error-container p-2 text-error">
            <Icon name="event_busy" size={20} />
          </span>
          <div>
            <p className="text-body-md font-semibold text-on-surface">Cancel this appointment?</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              This action will update the appointment status. Please provide a reason to continue.
            </p>
          </div>
        </div>

        <TextArea
          label="Reason for cancellation"
          placeholder="e.g. Patient requested to reschedule"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={255}
          error={error ?? undefined}
        />
        <p className="-mt-3 text-right text-label-md text-on-surface-variant">
          {reason.length}/255
        </p>
      </div>
    </Drawer>
  );
}
