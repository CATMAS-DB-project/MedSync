import { useCallback, useMemo } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { formatTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import type { Appointment, AppointmentStatus } from '../../../types';

export interface DoctorTodayScheduleCardProps {
  appointments: Appointment[];
  nextPatientId: number | null;
  isFirstLoad: boolean;
  isRefreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  lastUpdatedLabel: string;
  onOpenConsultation: (appointmentId: number) => void;
}

const DOT_COLOR: Record<AppointmentStatus, string> = {
  Scheduled: 'bg-primary',
  Completed: 'bg-success',
  'Re-Scheduled': 'bg-secondary',
  Cancelled: 'bg-outline',
};

export function DoctorTodayScheduleCard({
  appointments,
  nextPatientId,
  isFirstLoad,
  isRefreshing,
  error,
  onRetry,
  onRefresh,
  lastUpdatedLabel,
  onOpenConsultation,
}: DoctorTodayScheduleCardProps) {
  const sorted = useMemo(
    () =>
      [...appointments].sort((a, b) =>
        a.appointmentTime.localeCompare(b.appointmentTime),
      ),
    [appointments],
  );

  const handleRowClick = useCallback(
    (appointment: Appointment) => {
      if (appointment.status === 'Cancelled') return;
      onOpenConsultation(appointment.appointmentId);
    },
    [onOpenConsultation],
  );

  return (
    <Card padding="none">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
        <h2 className="text-headline-sm text-on-surface">Today&apos;s schedule</h2>
        <div className="flex items-center gap-2">
          <span className="hidden text-label-md text-on-surface-variant sm:inline">
            {lastUpdatedLabel}
          </span>
          <IconButton
            icon={isRefreshing ? 'progress_activity' : 'refresh'}
            size="sm"
            aria-label="Refresh schedule"
            onClick={onRefresh}
            className={cn(isRefreshing && 'animate-spin')}
          />
        </div>
      </header>

      {error && (
        <div className="p-3">
          <ErrorBanner message={error} onRetry={onRetry} />
        </div>
      )}

      {isFirstLoad ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={40} rounded="xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon="event_busy" title="No appointments today" />
      ) : (
        <ul className="flex flex-col py-2">
          {sorted.map((appointment, index) => {
            const isNext = appointment.appointmentId === nextPatientId;
            const isClickable = appointment.status !== 'Cancelled';
            const isLast = index === sorted.length - 1;

            return (
              <li
                key={appointment.appointmentId}
                onClick={isClickable ? () => handleRowClick(appointment) : undefined}
                className={cn(
                  'mx-2 grid grid-cols-[3.25rem_1rem_1fr] items-stretch gap-3 rounded-xl px-3 py-2.5 transition-colors',
                  isClickable && 'cursor-pointer hover:bg-surface-container-low',
                  !isClickable && 'opacity-60',
                  isNext && 'bg-primary-container/25',
                )}
              >
                <span className="pt-0.5 text-body-sm font-medium tabular-nums text-on-surface">
                  {formatTime(appointment.appointmentTime)}
                </span>

                <div className="relative flex justify-center">
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="absolute top-3 bottom-[-0.875rem] w-px bg-outline-variant"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative z-10 mt-1 h-2.5 w-2.5 rounded-full',
                      DOT_COLOR[appointment.status],
                    )}
                  />
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={appointment.patientName ?? 'Patient'} size="xs" />
                    <span className="truncate text-body-sm font-medium text-on-surface">
                      {appointment.patientName ?? '—'}
                    </span>
                    {appointment.isWalkIn && (
                      <Badge tone="secondary" pill>
                        Walk-in
                      </Badge>
                    )}
                  </div>
                  <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]} dot pill>
                    {appointment.status}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
