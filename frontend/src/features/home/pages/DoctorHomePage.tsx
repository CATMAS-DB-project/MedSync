import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useBranchNames } from '../../../hooks/useBranchNames';
import { fetchAppointments } from '../../../services/api/appointments';
import { ROUTES } from '../../../constants/routes';
import { formatDate, formatTime } from '../../../utils/formatters';
import { nowHHMM, toIsoDate, todayIso } from '../../../utils/dates';
import { DoctorNextPatientCard } from '../components/DoctorNextPatientCard';
import { DoctorTodayScheduleCard } from '../components/DoctorTodayScheduleCard';
import type { Appointment, PagedResult } from '../../../types';

const AUTO_REFRESH_MS = 60_000;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

export function DoctorHomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useAuth();

  const isDoctor = currentUser?.role === 'Doctor';
  const doctorId = currentUser?.staffId;
  const branchId = currentUser?.branchId;
  const today = todayIso();
  const tomorrow = useMemo(() => getTomorrowIso(), []);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMountedRef = useRef(true);
  const seenIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Branches (for header chip)
  const { getBranchName } = useBranchNames(Boolean(branchId && !currentUser?.branchName));
  const branchName =
    currentUser?.branchName ?? getBranchName(branchId) ?? 'Current branch';

  // Today's appointments for this doctor
  const appointmentsToday = useAsync<PagedResult<Appointment>>(
    () =>
      isDoctor && doctorId
        ? fetchAppointments({ doctorId, date: today, pageSize: 100 })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    [isDoctor, doctorId, today],
  );

  // Tomorrow's scheduled count
  const tomorrowCount = useAsync<PagedResult<Appointment>>(
    () =>
      isDoctor && doctorId && branchId
        ? fetchAppointments({
            branchId,
            doctorId,
            date: tomorrow,
            status: 'Scheduled',
            pageSize: 1,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 1 }),
    [isDoctor, doctorId, branchId, tomorrow],
  );

  const items = appointmentsToday.data?.items ?? [];

  // Next patient
  const nextPatient = useMemo(() => {
    const scheduled = items.filter((a) => a.status === 'Scheduled');
    if (scheduled.length === 0) return null;
    const sorted = [...scheduled].sort((a, b) =>
      a.appointmentTime.localeCompare(b.appointmentTime),
    );
    const now = nowHHMM();
    const upcoming = sorted.find((a) => a.appointmentTime >= now);
    return upcoming ?? sorted[0] ?? null;
  }, [items]);

  // Stats
  const stats = useMemo(() => {
    const completed = items.filter((a) => a.status === 'Completed').length;
    const scheduled = items.filter((a) => a.status === 'Scheduled').length;
    return { total: items.length, completed, remaining: scheduled };
  }, [items]);

  // Last-updated label
  useEffect(() => {
    if (appointmentsToday.data) setLastUpdated(new Date());
  }, [appointmentsToday.data]);

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Loading…';
    const hh = String(lastUpdated.getHours()).padStart(2, '0');
    const mm = String(lastUpdated.getMinutes()).padStart(2, '0');
    return `Updated ${formatTime(`${hh}:${mm}`)}`;
  }, [lastUpdated]);

  // New arrivals toast (skip first load)
  useEffect(() => {
    if (!appointmentsToday.data) return;
    const list = appointmentsToday.data.items;
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(list.map((a) => a.appointmentId));
      return;
    }
    const seen = seenIdsRef.current;
    for (const appointment of list) {
      if (seen.has(appointment.appointmentId)) continue;
      seen.add(appointment.appointmentId);
      const name = appointment.patientName ?? 'Patient';
      if (appointment.isWalkIn) {
        toast.info(`New walk-in: ${name}`);
      } else {
        toast.info(`New appointment: ${name} at ${formatTime(appointment.appointmentTime)}`);
      }
    }
  }, [appointmentsToday.data, toast]);

  // Refresh
  const refreshAll = useCallback(() => {
    appointmentsToday.reload();
    tomorrowCount.reload();
  }, [appointmentsToday.reload, tomorrowCount.reload]);

  // Auto-refresh (paused when tab hidden) + immediate refresh on visibility
  useEffect(() => {
    if (!isDoctor) return;
    const tick = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    const interval = window.setInterval(tick, AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDoctor, refreshAll]);

  const handleOpenConsultation = useCallback(
    (appointmentId: number) => {
      navigate(
        generatePath(ROUTES.CONSULTATION, { appointmentId: String(appointmentId) }),
      );
    },
    [navigate],
  );

  const handleViewTomorrow = useCallback(() => {
    if (!branchId || !doctorId) return;
    navigate(
      `${ROUTES.APPOINTMENTS}?date=${tomorrow}&branchId=${branchId}&doctorId=${doctorId}`,
    );
  }, [navigate, tomorrow, branchId, doctorId]);

  if (!isDoctor || !currentUser) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Access restricted" />
      </div>
    );
  }

  const isFirstLoad = appointmentsToday.isLoading && appointmentsToday.data === undefined;
  const isRefreshing = appointmentsToday.isLoading && appointmentsToday.data !== undefined;
  const showTopError = appointmentsToday.error !== null && appointmentsToday.data === undefined;

  const statValue = (n: number): string => {
    if (appointmentsToday.error && appointmentsToday.data === undefined) return '—';
    return String(n);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-sm text-on-surface">
            {getGreeting()}, Dr. {currentUser.lastName || currentUser.firstName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" pill>
              <Icon name="today" size={12} />
              {formatDate(today)}
            </Badge>
            <Badge tone="neutral" pill>
              <Icon name="location_on" size={12} />
              {branchName}
            </Badge>
          </div>
        </div>
      </header>

      {showTopError && (
        <ErrorBanner message={appointmentsToday.error ?? ''} onRetry={refreshAll} />
      )}

      {/* Next patient */}
      <DoctorNextPatientCard
        appointment={nextPatient}
        onStartConsultation={handleOpenConsultation}
      />

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-3">
        {isFirstLoad ? (
          <>
            <Skeleton height={92} rounded="xl" />
            <Skeleton height={92} rounded="xl" />
            <Skeleton height={92} rounded="xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Today"
              value={statValue(stats.total)}
              icon="event_note"
            />
            <StatCard
              label="Completed"
              value={statValue(stats.completed)}
              icon="task_alt"
            />
            <StatCard
              label="Remaining"
              value={statValue(stats.remaining)}
              icon="schedule"
            />
          </>
        )}
      </section>

      {/* Schedule + Tomorrow */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DoctorTodayScheduleCard
            appointments={items}
            nextPatientId={nextPatient?.appointmentId ?? null}
            isFirstLoad={isFirstLoad}
            isRefreshing={isRefreshing}
            error={appointmentsToday.error && appointmentsToday.data !== undefined ? null : appointmentsToday.error}
            onRetry={refreshAll}
            onRefresh={refreshAll}
            lastUpdatedLabel={updatedLabel}
            onOpenConsultation={handleOpenConsultation}
          />
        </div>

        <div className="lg:col-span-1">
          <Card padding="lg">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-headline-sm text-on-surface">Tomorrow</h2>
                <span className="text-label-md text-on-surface-variant">
                  {formatDate(tomorrow)}
                </span>
              </div>

              {tomorrowCount.isLoading && tomorrowCount.data === undefined ? (
                <Skeleton height={48} rounded="xl" />
              ) : tomorrowCount.error && tomorrowCount.data === undefined ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-display-sm text-on-surface-variant">—</span>
                  <Button variant="ghost" size="sm" icon="refresh" onClick={tomorrowCount.reload}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-display-md font-bold text-on-surface">
                    {tomorrowCount.data?.total ?? 0}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    scheduled
                  </span>
                </div>
              )}

              <Button variant="secondary" onClick={handleViewTomorrow}>
                View
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
