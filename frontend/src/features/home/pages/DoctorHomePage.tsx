import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { TableSkeleton } from '../../../components/common/TableSkeleton';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchAppointmentTreatments } from '../../../services/api/appointmentTreatments';
import { fetchBranches } from '../../../services/api/branches';
import { ROUTES } from '../../../constants/routes';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { formatDate, formatTime } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import type { Appointment } from '../../../types';

function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function sortByTime(a: Appointment, b: Appointment) {
  return timeToMinutes(a.appointmentTime) - timeToMinutes(b.appointmentTime);
}

export function DoctorHomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useAuth();
  const today = todayIso();

  const doctorId = currentUser?.staffId;
  const branchId = currentUser?.branchId;

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const branchName =
    branches.data?.items.find((branch) => branch.branchId === branchId)?.branchName ?? 'Current branch';

  const appointmentsToday = useAsync(
    () =>
      doctorId
        ? fetchAppointments({ doctorId, date: today, page: 1, pageSize: 100 })
        : Promise.resolve({ total: 0, items: [] as Appointment[] }),
    [doctorId, today],
  );

  const followUp = useAsync(async () => {
    if (!doctorId) return [] as Appointment[];

    const completed = await fetchAppointments({
      doctorId,
      date: today,
      status: 'Completed',
      page: 1,
      pageSize: 10,
    });

    const needsFollowUp: Appointment[] = [];
    for (const appointment of completed.items.slice(0, 10)) {
      const treatments = await fetchAppointmentTreatments(appointment.appointmentId);
      if (treatments.length === 0) {
        needsFollowUp.push(appointment);
      }
    }

    return needsFollowUp;
  }, [doctorId, today]);

  const schedule = useMemo(
    () => [...(appointmentsToday.data?.items ?? [])].sort(sortByTime),
    [appointmentsToday.data],
  );

  const counters = useMemo(() => {
    const items = appointmentsToday.data?.items ?? [];
    return {
      total: items.length,
      scheduled: items.filter((item) => item.status === 'Scheduled').length,
      completed: items.filter((item) => item.status === 'Completed').length,
      cancelled: items.filter((item) => item.status === 'Cancelled').length,
    };
  }, [appointmentsToday.data]);

  const nowMinutes = timeToMinutes(new Date().toTimeString().slice(0, 5));
  const nextPatient = useMemo(() => {
    const scheduled = schedule.filter((item) => item.status === 'Scheduled');
    if (scheduled.length === 0) return null;

    const upcoming = scheduled.find((item) => timeToMinutes(item.appointmentTime) >= nowMinutes);
    if (upcoming) return upcoming;

    return [...scheduled].sort(sortByTime)[0];
  }, [schedule, nowMinutes]);

  const openConsultation = (appointmentId: number) => {
    toast.info('Opening consultation');
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };

  useEffect(() => {
    const refresh = () => {
      appointmentsToday.reload();
      followUp.reload();
    };

    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 2 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [appointmentsToday.reload, followUp.reload]);

  if (!currentUser || currentUser.role !== 'Doctor') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-display-sm text-on-surface">Doctor Home</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">Access restricted to doctors.</p>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <header className="mb-5 flex flex-col gap-3 border-b border-outline-variant pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-body-sm text-on-surface-variant">Doctor dashboard</p>
          <h1 className="text-display-sm text-on-surface">
            {greeting}, Dr. {currentUser.username || currentUser.staffId}
          </h1>
        </div>
        <div className="flex flex-col items-start gap-1 text-body-sm text-on-surface-variant md:items-end">
          <span>{formatDate(today)}</span>
          <span>{branchName}</span>
        </div>
      </header>

      <section className="mb-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-5">
        {appointmentsToday.error && (
          <ErrorBanner message={appointmentsToday.error} onRetry={appointmentsToday.reload} className="mb-3" />
        )}

        {nextPatient ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-label-md uppercase tracking-wide text-on-surface-variant">Next patient</span>
                {timeToMinutes(nextPatient.appointmentTime) < nowMinutes && (
                  <Badge tone="warning">Overdue</Badge>
                )}
              </div>
              <div className="text-2xl font-semibold text-on-surface md:text-3xl">
                {nextPatient.patientName}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
                <span>{formatTime(nextPatient.appointmentTime)}</span>
                {nextPatient.isWalkIn && <Badge tone="secondary">Walk-in</Badge>}
                <Badge tone={APPOINTMENT_STATUS_TONE[nextPatient.status]}>{nextPatient.status}</Badge>
              </div>
            </div>

            <Button variant="primary" icon="medical_services" onClick={() => openConsultation(nextPatient.appointmentId)}>
              Open consultation
            </Button>
          </div>
        ) : (
          <EmptyState
            title="No more patients today"
            description="There are no scheduled visits left for your doctor queue."
            icon="event_busy"
          />
        )}
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Total</div>
          <div className="mt-2 text-3xl font-semibold text-on-surface">{counters.total}</div>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Scheduled</div>
          <div className="mt-2 text-3xl font-semibold text-on-surface">{counters.scheduled}</div>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Completed</div>
          <div className="mt-2 text-3xl font-semibold text-on-surface">{counters.completed}</div>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Cancelled</div>
          <div className="mt-2 text-3xl font-semibold text-on-surface">{counters.cancelled}</div>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="mb-3 text-headline-sm text-on-surface">Today's schedule</h2>

        {appointmentsToday.isLoading && schedule.length === 0 ? (
          <TableSkeleton rows={4} columns={4} className="py-2" />
        ) : schedule.length === 0 ? (
          <EmptyState
            title="No appointments for today"
            description="You do not have any appointments in your schedule yet."
            icon="calendar_today"
          />
        ) : (
          <div className="space-y-2">
            {schedule.map((appointment) => {
              const isNext = nextPatient && nextPatient.appointmentId === appointment.appointmentId;

              return (
                <div
                  key={appointment.appointmentId}
                  className={[
                    'flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between',
                    isNext
                      ? 'border-primary bg-primary-container/10'
                      : 'border-outline-variant bg-surface-container-low',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-body-md font-medium text-on-surface">
                      {formatTime(appointment.appointmentTime)}
                    </div>
                    <div>
                      <div className="text-body-md font-medium text-on-surface">{appointment.patientName}</div>
                      {appointment.isWalkIn && (
                        <div className="mt-1 text-label-md text-on-surface-variant">Walk-in visit</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                    {appointment.isWalkIn && <Badge tone="secondary">Walk-in</Badge>}
                    {(appointment.status === 'Scheduled' || appointment.status === 'Completed') && (
                      <Button
                        variant={isNext ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => openConsultation(appointment.appointmentId)}
                      >
                        Open
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="mb-3 text-headline-sm text-on-surface">Needs follow-up</h2>

        {followUp.error && (
          <ErrorBanner message={followUp.error} onRetry={followUp.reload} className="mb-3" />
        )}

        {followUp.isLoading && followUp.data === undefined ? (
          <TableSkeleton rows={3} columns={3} className="py-2" />
        ) : (followUp.data ?? []).length === 0 ? (
          <EmptyState
            title="No follow-up needed"
            description="All completed visits today have treatment notes logged."
            icon="check_circle"
          />
        ) : (
          <div className="space-y-2">
            {(followUp.data ?? []).map((appointment) => (
              <div
                key={appointment.appointmentId}
                className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-body-md font-medium text-on-surface">{appointment.patientName}</div>
                  <div className="text-body-sm text-on-surface-variant">
                    {formatTime(appointment.appointmentTime)} · completed today
                  </div>
                </div>

                <Button variant="secondary" size="sm" onClick={() => openConsultation(appointment.appointmentId)}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
