import { useEffect, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    setError(null);
    try {
      await cancelAppointment(appointment.appointmentId, { reason: reason.trim() });
      onCancelled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the appointment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={appointment !== null}
      onClose={onClose}
      title="Cancel appointment"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            isLoading={isSubmitting}
          >
            Cancel appointment
          </Button>
        </>
      }
    >
      {appointment && (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 text-body-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-label-md text-on-surface-variant">Patient</dt>
              <dd className="text-right font-medium text-on-surface">
                {appointment.patientName ?? '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-label-md text-on-surface-variant">Doctor</dt>
              <dd className="text-right text-on-surface">{appointment.doctorName ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-label-md text-on-surface-variant">When</dt>
              <dd className="text-right text-on-surface">
                {formatDate(appointment.appointmentDate)} ·{' '}
                {formatTime(appointment.appointmentTime)}
              </dd>
            </div>
          </dl>

          <TextArea
            label="Reason"
            placeholder="e.g. Patient requested to reschedule"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={255}
            error={error ?? undefined}
          />
        </div>
      )}
    </Modal>
  );
}
