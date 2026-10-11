import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { Button } from '../../../components/ui/Button';
import { TextArea } from '../../../components/ui/TextArea';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import {
  fetchAppointmentAvailability,
  rescheduleAppointment,
} from '../../../services/api/appointments';
import { toIsoDate, todayIso } from '../../../utils/dates';
import { formatDate, formatTime } from '../../../utils/formatters';
import { DateStrip } from './DateStrip';
import { SlotGrid } from './SlotGrid';
import type { Appointment, AvailabilitySlot } from '../../../types';

export interface RescheduleAppointmentDrawerProps {
  appointment: Appointment | null;
  onClose: () => void;
  onRescheduled: (newAppointment: Appointment) => void;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return toIsoDate(date);
}

function buildNext14Days(): string[] {
  const today = todayIso();
  return Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
}

export function RescheduleAppointmentDrawer({
  appointment,
  onClose,
  onRescheduled,
}: RescheduleAppointmentDrawerProps) {
  const today = todayIso();
  const next14 = useMemo(() => buildNext14Days(), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (appointment) {
      const tomorrow = addDaysIso(today, 1);
      const isAfterClinicHours = new Date().getHours() >= 17;
      let initialDate =
        appointment.appointmentDate > today
          ? appointment.appointmentDate
          : isAfterClinicHours
            ? tomorrow
            : today;
      if (initialDate < today) initialDate = today;
      setSelectedDate(initialDate);
    } else {
      setSelectedDate(today);
    }
    setSelectedTime(null);
    setReason('');
    setSubmitError(null);
  }, [appointment, today]);

  const doctorId = appointment?.doctorStaffId ?? null;

  const availability = useAsync<AvailabilitySlot[]>(
    () =>
      doctorId === null
        ? Promise.resolve([])
        : fetchAppointmentAvailability(doctorId, selectedDate),
    [doctorId, selectedDate],
  );

  async function handleConfirm() {
    if (!appointment) return;
    setSubmitError(null);

    if (!selectedTime) {
      setSubmitError('Please select a new time slot.');
      return;
    }

    const trimmedReason = reason.trim();

    setIsSubmitting(true);
    try {
      const updated = await rescheduleAppointment(appointment.appointmentId, {
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      onRescheduled(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setSubmitError(
          err.message || 'That slot was just taken. Please pick another time.',
        );
        setSelectedTime(null);
        availability.reload();
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Could not reschedule the appointment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={appointment !== null}
      onClose={onClose}
      title="Reschedule appointment"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="event_repeat"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={!selectedTime || isSubmitting}
          >
            Confirm reschedule
          </Button>
        </>
      }
    >
      {appointment && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-1 gap-2 rounded-xl bg-surface-container-low p-3 text-body-sm sm:grid-cols-3">
            <div>
              <dt className="text-label-md text-on-surface-variant">Patient</dt>
              <dd className="font-medium text-on-surface">
                {appointment.patientName ?? `Patient #${appointment.patientId}`}
              </dd>
            </div>
            <div>
              <dt className="text-label-md text-on-surface-variant">Doctor</dt>
              <dd className="text-on-surface">{appointment.doctorName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-label-md text-on-surface-variant">Current slot</dt>
              <dd className="text-on-surface">
                {formatDate(appointment.appointmentDate)} ·{' '}
                {formatTime(appointment.appointmentTime)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3">
            <h3 className="text-title-sm font-semibold text-on-surface">
              1. Pick new date &amp; time
            </h3>

            <DateStrip
              days={next14}
              value={selectedDate}
              onChange={(iso) => {
                setSelectedDate(iso);
                setSelectedTime(null);
                setSubmitError(null);
              }}
              today={today}
              minDate={today}
            />

            <div className="max-w-xs">
              <label className="text-label-md font-medium text-on-surface">
                Jump to date
                <input
                  type="date"
                  value={selectedDate}
                  min={today}
                  onChange={(event) => {
                    if (event.target.value) {
                      setSelectedDate(event.target.value);
                      setSelectedTime(null);
                      setSubmitError(null);
                    }
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <SlotGrid
              slots={availability.data ?? []}
              loading={availability.isLoading}
              error={availability.error}
              onRetry={availability.reload}
              selectedTime={selectedTime}
              onSelect={(time) => {
                setSelectedTime(time);
                setSubmitError(null);
              }}
              date={selectedDate}
            />
          </div>

          <TextArea
            label="2. Reason for rescheduling (optional)"
            placeholder="e.g. Patient requested an afternoon slot"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={255}
          />

          {submitError && <ErrorBanner message={submitError} />}
        </div>
      )}
    </Modal>
  );
}

