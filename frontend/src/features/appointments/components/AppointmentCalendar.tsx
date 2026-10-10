import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { cn } from '../../../utils/cn';
import { dayNumber, weekDaysFrom, weekdayShort } from '../dateUtils';
import type { Appointment, Role } from '../../../types';
import { AppointmentRowActions } from './AppointmentRowActions';

export interface AppointmentCalendarProps {
  weekStart: string;
  selectedDate: string;
  todayIso: string;
  appointments: Appointment[];
  loading: boolean;
  dayErrors: Record<string, string>;
  onDayErrorRetry: () => void;
  onSelectDay: (iso: string) => void;
  role: Role | undefined;
  onViewPatient: (patientId: number) => void;
  onCancel: (appointment: Appointment) => void;
  onOpenConsultation: (appointmentId: number) => void;
}

export function AppointmentCalendar({
  weekStart,
  selectedDate,
  todayIso,
  appointments,
  loading,
  dayErrors,
  onDayErrorRetry,
  onSelectDay,
  role,
  onViewPatient,
  onCancel,
  onOpenConsultation,
}: AppointmentCalendarProps) {
  const days = useMemo(() => weekDaysFrom(weekStart), [weekStart]);
  const [mobileDay, setMobileDay] = useState<string>(selectedDate);

  useEffect(() => {
    setMobileDay(selectedDate);
  }, [selectedDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const day of days) map.set(day, []);
    for (const appointment of appointments) {
      const list = map.get(appointment.appointmentDate);
      if (list) list.push(appointment);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
    }
    return map;
  }, [days, appointments]);

  const renderChip = (appointment: Appointment) => (
    <div
      key={appointment.appointmentId}
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-left transition-colors hover:bg-primary-container/30"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 h-8 w-1 shrink-0 rounded-full',
            appointment.status === 'Scheduled' && 'bg-primary',
            appointment.status === 'Completed' && 'bg-success',
            appointment.status === 'Cancelled' && 'bg-outline',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-label-md font-semibold text-on-surface">
              {appointment.appointmentTime}
            </span>
            <span className="text-on-surface-variant">·</span>
            <span className="truncate text-body-sm font-medium text-on-surface">
              {appointment.patientName ?? 'Patient'}
            </span>
          </div>
          <div className="truncate text-label-md text-on-surface-variant">
            {appointment.doctorName ?? '—'}
          </div>
        </div>
        <div className="shrink-0">
          <AppointmentRowActions
            appointment={appointment}
            role={role}
            onViewPatient={onViewPatient}
            onCancel={onCancel}
            onOpenConsultation={onOpenConsultation}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop: 7-column grid */}
      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {days.map((day) => {
          const isToday = day === todayIso;
          const dayAppointments = byDay.get(day) ?? [];
          const dayError = dayErrors[day];

          return (
            <div
              key={day}
              className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-container-low p-2"
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low',
                  'hover:bg-surface-container-high',
                )}
              >
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                  {weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-label-md font-semibold',
                    isToday
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface',
                  )}
                >
                  {dayNumber(day)}
                </span>
              </button>

              <div className="flex max-h-[420px] min-h-[6rem] flex-col gap-1.5 overflow-y-auto pr-0.5">
                {dayError ? (
                  <ErrorBanner message={dayError} onRetry={onDayErrorRetry} />
                ) : loading && dayAppointments.length === 0 ? (
                  <>
                    <Skeleton height={44} rounded="xl" />
                    <Skeleton height={44} rounded="xl" />
                  </>
                ) : dayAppointments.length === 0 ? (
                  <span className="py-3 text-center text-label-md text-on-surface-variant/60">
                    —
                  </span>
                ) : (
                  dayAppointments.map(renderChip)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: day strip + selected day chips */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {days.map((day) => {
            const isToday = day === todayIso;
            const isActive = day === mobileDay;
            const count = byDay.get(day)?.length ?? 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setMobileDay(day)}
                className={cn(
                  'flex min-w-[3.5rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high',
                )}
              >
                <span
                  className={cn(
                    'text-label-sm uppercase tracking-wider',
                    isActive ? 'text-on-primary/80' : 'text-on-surface-variant',
                  )}
                >
                  {weekdayShort(day)}
                </span>
                <span
                  className={cn(
                    'text-body-md font-semibold',
                    isToday && !isActive && 'text-primary',
                  )}
                >
                  {dayNumber(day)}
                </span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    count === 0
                      ? 'bg-transparent'
                      : isActive
                        ? 'bg-on-primary'
                        : 'bg-primary',
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {(() => {
            const dayError = dayErrors[mobileDay];
            const dayAppointments = byDay.get(mobileDay) ?? [];
            if (dayError) return <ErrorBanner message={dayError} onRetry={onDayErrorRetry} />;
            if (loading && dayAppointments.length === 0) {
              return (
                <>
                  <Skeleton height={56} rounded="xl" />
                  <Skeleton height={56} rounded="xl" />
                </>
              );
            }
            if (dayAppointments.length === 0) {
              return (
                <p className="py-6 text-center text-label-md text-on-surface-variant/60">—</p>
              );
            }
            return dayAppointments.map(renderChip);
          })()}
        </div>
      </div>
    </div>
  );
}

// Silence unused-import warnings if any refactor drops these.
export type { Role as _Role, Appointment as _Appointment, Avatar as _Avatar, Badge as _Badge };
