import { useCallback } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchPatientById } from '../../../services/api/patients';
import { calculateAge, formatDate, formatTime } from '../../../utils/formatters';
import { nowHHMM } from '../../../utils/dates';
import type { Appointment } from '../../../types';

export interface DoctorNextPatientCardProps {
  appointment: Appointment | null;
  onStartConsultation: (appointmentId: number) => void;
}

export function DoctorNextPatientCard({
  appointment,
  onStartConsultation,
}: DoctorNextPatientCardProps) {
  const patientId = appointment?.patientId ?? null;
  const appointmentId = appointment?.appointmentId ?? null;

  // Patient age — independent, non-blocking.
  const patient = useAsync(
    () => (patientId === null ? Promise.resolve(null) : fetchPatientById(patientId)),
    [patientId, appointmentId],
  );

  // Last visit — independent, non-blocking, silent on failure.
  const lastVisit = useAsync(
    () =>
      patientId === null
        ? Promise.resolve(null as string | null)
        : fetchAppointments({ patientId, status: 'Completed', pageSize: 5 })
            .then((res) => {
              const dates = res.items
                .map((a) => a.appointmentDate)
                .filter((d): d is string => Boolean(d));
              if (dates.length === 0) return null;
              dates.sort((a, b) => b.localeCompare(a));
              return dates[0] ?? null;
            })
            .catch(() => null),
    [patientId, appointmentId],
  );

  const handleStart = useCallback(() => {
    if (appointment === null) return;
    onStartConsultation(appointment.appointmentId);
  }, [appointment, onStartConsultation]);

  if (appointment === null) {
    return (
      <Card padding="lg">
        <EmptyState icon="event_available" title="No patients waiting" />
      </Card>
    );
  }

  const isOverdue = appointment.appointmentTime < nowHHMM();
  const age = patient.data ? calculateAge(patient.data.dateOfBirth) : null;

  return (
    <Card padding="lg" className="border border-primary/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={appointment.patientName ?? 'Patient'} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Next patient
              </span>
              {isOverdue && (
                <Badge tone="warning" pill dot>
                  Overdue
                </Badge>
              )}
            </div>

            <div className="mt-1 truncate text-headline-md text-on-surface">
              {appointment.patientName ?? 'Patient'}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
              <span>{formatTime(appointment.appointmentTime)}</span>
              {age !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{age} yrs</span>
                </>
              )}
              {appointment.isWalkIn && (
                <Badge tone="secondary" pill>
                  Walk-in
                </Badge>
              )}
            </div>

            {lastVisit.data && (
              <div className="mt-1 text-label-md text-on-surface-variant">
                Last visit: {formatDate(lastVisit.data)}
              </div>
            )}
          </div>
        </div>

        <Button
          variant="primary"
          icon="stethoscope"
          onClick={handleStart}
          className="w-full shrink-0 md:w-auto"
        >
          Start consultation
        </Button>
      </div>
    </Card>
  );
}
