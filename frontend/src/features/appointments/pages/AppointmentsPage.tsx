import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import type { SelectOption } from '../../../components/ui/Select';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useToast } from '../../../components/common/ToastProvider';
import { fetchAppointments } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import type { DoctorOption } from '../../../services/api/doctorOptions';
import { ApiError } from '../../../services/api/ApiError';
import { ROUTES } from '../../../constants/routes';
import { todayIso } from '../../../utils/dates';
import { formatTime } from '../../../utils/formatters';
import { APPOINTMENT_STATUS_TONE } from '../statusStyles';
import { AppointmentToolbar } from '../components/AppointmentToolbar';
import type { AppointmentsView } from '../components/AppointmentToolbar';
import { AppointmentCalendar } from '../components/AppointmentCalendar';
import { AppointmentRowActions } from '../components/AppointmentRowActions';
import { CancelAppointmentDrawer } from '../components/CancelAppointmentDrawer';
import { PatientDetailDrawer } from '../../patients/components/PatientDetailDrawer';
import {
  addDays,
  formatDayLabel,
  formatWeekLabel,
  startOfWeek,
  weekDaysFrom,
} from '../dateUtils';
import type { Appointment, AppointmentStatus } from '../../../types';

// Backend caps query.page_size at 100.
const PAGE_SIZE = 100;
const DAY_MS_ISO = /^\d{4}-\d{2}-\d{2}$/;

type StatusTab = 'All' | AppointmentStatus;

interface FetchResult {
  items: Appointment[];
  dayErrors: Record<string, string>;
}

function parseStatusParam(value: string | null): StatusTab {
  if (value === 'Scheduled' || value === 'Completed' || value === 'Cancelled') return value;
  return 'All';
}

function parseViewParam(value: string | null): AppointmentsView {
  return value === 'calendar' ? 'calendar' : 'list';
}

function parseDateParam(value: string | null): string {
  if (value && DAY_MS_ISO.test(value)) return value;
  return todayIso();
}

function parseIdParam(value: string | null): string {
  if (!value) return 'all';
  return value;
}

export function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const role = currentUser?.role;

  const isReceptionist = role === 'Receptionist';
  const isDoctor = role === 'Doctor';
  const isAdmin = role === 'Admin';
  const isBranchManager = role === 'Branch Manager';
  const canBook = isReceptionist;
  const canOpenConsultation = role === 'Admin' || role === 'Doctor';
  const showBranchSelect = isAdmin;
  const showDoctorSelect = isAdmin || isBranchManager || isReceptionist;

  // ---- URL state ----
  const view = parseViewParam(searchParams.get('view'));
  const date = parseDateParam(searchParams.get('date'));
  const branchParam = parseIdParam(searchParams.get('branchId'));
  const doctorParam = parseIdParam(searchParams.get('doctorId'));
  const statusTab = parseStatusParam(searchParams.get('status'));

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // ---- Effective filters by role ----
  const effectiveBranchId: number | undefined = useMemo(() => {
    if ((isDoctor || isBranchManager) && currentUser) return currentUser.branchId;
    if (branchParam && branchParam !== 'all') return Number(branchParam);
    if (isReceptionist && currentUser) return currentUser.branchId;
    return undefined;
  }, [isDoctor, isBranchManager, isReceptionist, currentUser, branchParam]);

  const effectiveDoctorId: number | undefined = useMemo(() => {
    if (isDoctor && currentUser) return currentUser.staffId;
    if (doctorParam && doctorParam !== 'all') return Number(doctorParam);
    return undefined;
  }, [isDoctor, currentUser, doctorParam]);

  // ---- Week range ----
  const weekStart = useMemo(() => startOfWeek(date), [date]);
  const weekDaysList = useMemo(() => weekDaysFrom(weekStart), [weekStart]);

  // ---- Data ----
  const appointments = useAsync<FetchResult>(async () => {
    if (view === 'list') {
      const result = await fetchAppointments({
        date,
        branchId: effectiveBranchId,
        doctorId: effectiveDoctorId,
        pageSize: PAGE_SIZE,
      });
      return { items: result.items, dayErrors: {} };
    }
    const results = await Promise.all(
      weekDaysList.map(async (day) => {
        try {
          const r = await fetchAppointments({
            date: day,
            branchId: effectiveBranchId,
            doctorId: effectiveDoctorId,
            pageSize: PAGE_SIZE,
          });
          return { day, items: r.items, error: null as string | null };
        } catch (err) {
          return {
            day,
            items: [] as Appointment[],
            error: err instanceof ApiError ? err.message : 'Failed to load',
          };
        }
      }),
    );
    const items: Appointment[] = [];
    const dayErrors: Record<string, string> = {};
    for (const r of results) {
      items.push(...r.items);
      if (r.error) dayErrors[r.day] = r.error;
    }
    return { items, dayErrors };
  }, [view, date, weekStart, effectiveBranchId, effectiveDoctorId]);

  const rawItems = appointments.data?.items ?? [];
  const dayErrors = appointments.data?.dayErrors ?? {};

  // ---- Client-side status filter + counts ----
  const counts = useMemo(() => {
    let scheduled = 0;
    let completed = 0;
    let cancelled = 0;
    for (const item of rawItems) {
      if (item.status === 'Scheduled') scheduled += 1;
      else if (item.status === 'Completed') completed += 1;
      else if (item.status === 'Cancelled') cancelled += 1;
    }
    return {
      all: rawItems.length,
      scheduled,
      completed,
      cancelled,
    };
  }, [rawItems]);

  const filteredItems = useMemo(
    () =>
      statusTab === 'All'
        ? rawItems
        : rawItems.filter((item) => item.status === statusTab),
    [rawItems, statusTab],
  );

  // ---- Branches + doctors ----
  const branches = useAsync(
    () => (showBranchSelect ? fetchBranches(1, 100) : Promise.resolve(null)),
    [showBranchSelect],
  );
  const branchOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ label: 'All branches', value: 'all' }];
    for (const b of branches.data?.items ?? []) {
      opts.push({ label: b.branchName, value: String(b.branchId) });
    }
    return opts;
  }, [branches.data]);

  const doctors = useAsync<DoctorOption[]>(
    () =>
      showDoctorSelect
        ? fetchDoctorOptions(effectiveBranchId ? { branchId: effectiveBranchId } : {})
        : Promise.resolve([] as DoctorOption[]),
    [showDoctorSelect, effectiveBranchId],
  );
  const doctorOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ label: 'All doctors', value: 'all' }];
    for (const d of doctors.data ?? []) {
      opts.push({ label: d.doctorName, value: String(d.staffId) });
    }
    return opts;
  }, [doctors.data]);

  useEffect(() => {
    if (!showDoctorSelect) return;
    if (doctorParam === 'all' || !doctorParam) return;
    if (!doctors.data) return;
    const exists = doctors.data.some((d) => String(d.staffId) === doctorParam);
    if (!exists) updateParams({ doctorId: null });
  }, [showDoctorSelect, doctorParam, doctors.data, updateParams]);

  // ---- Derived UI state ----
  const [toCancel, setToCancel] = useState<Appointment | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const isFirstLoad = appointments.isLoading && appointments.data === undefined;

  const nextUpcomingId = useMemo(() => {
    if (date !== todayIso()) return null;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nowTime = `${hh}:${mm}`;
    const today = rawItems
      .filter((a) => a.appointmentDate === date && a.status === 'Scheduled')
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
    return today.find((a) => a.appointmentTime >= nowTime)?.appointmentId ?? null;
  }, [rawItems, date]);

  // ---- Handlers ----
  const handlePrev = () => {
    updateParams({ date: view === 'calendar' ? addDays(date, -7) : addDays(date, -1) });
  };
  const handleNext = () => {
    updateParams({ date: view === 'calendar' ? addDays(date, 7) : addDays(date, 1) });
  };
  const handleToday = () => updateParams({ date: todayIso() });

  const openConsultation = (appointmentId: number) => {
    if (!canOpenConsultation) return;
    navigate(ROUTES.CONSULTATION.replace(':appointmentId', String(appointmentId)));
  };

  const handleSelectDay = (day: string) => {
    updateParams({ view: 'list', date: day });
  };

  const statusTabs: TabItem<StatusTab>[] = [
    { value: 'All', label: `All (${counts.all})` },
    { value: 'Scheduled', label: `Scheduled (${counts.scheduled})` },
    { value: 'Completed', label: `Completed (${counts.completed})` },
    { value: 'Cancelled', label: `Cancelled (${counts.cancelled})` },
  ];

  const columns: DataTableColumn<Appointment>[] = [
    {
      key: 'patient',
      header: 'Patient',
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={row.patientName ?? 'Patient'} size="xs" />
          <span className="truncate">{row.patientName ?? '—'}</span>
          {row.isWalkIn && (
            <Badge tone="secondary" pill className="shrink-0">
              Walk-in
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      secondary: true,
      cell: (row) => formatTime(row.appointmentTime),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      hideOnMobile: true,
      cell: (row) => <span className="truncate">{row.doctorName ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={APPOINTMENT_STATUS_TONE[row.status]} dot pill>
          {row.status}
        </Badge>
      ),
    },
  ];

  const dateLabel =
    view === 'calendar'
      ? formatWeekLabel(weekStart, addDays(weekStart, 6))
      : formatDayLabel(date);

  const listRowClassName = (row: Appointment): string | undefined => {
    const classes: string[] = [];
    if (row.status === 'Cancelled') classes.push('opacity-60');
    if (date === todayIso() && row.appointmentId === nextUpcomingId) {
      classes.push('bg-primary-container/30');
    }
    return classes.length > 0 ? classes.join(' ') : undefined;
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Appointments"
        actions={
          canBook ? (
            <>
              <Button
                variant="secondary"
                icon="directions_walk"
                onClick={() => navigate(ROUTES.WALK_IN)}
              >
                Walk-in
              </Button>
              <Button
                variant="primary"
                icon="add"
                onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}
              >
                Book appointment
              </Button>
            </>
          ) : undefined
        }
      />

      <AppointmentToolbar
        view={view}
        onViewChange={(next) => updateParams({ view: next })}
        date={date}
        onDateChange={(iso) => updateParams({ date: iso })}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        dateLabel={dateLabel}
        showBranchSelect={showBranchSelect}
        branchId={branchParam}
        branchOptions={branchOptions}
        onBranchChange={(value) =>
          updateParams({ branchId: value === 'all' ? null : value, doctorId: null })
        }
        showDoctorSelect={showDoctorSelect}
        doctorId={doctorParam}
        doctorOptions={doctorOptions}
        onDoctorChange={(value) => updateParams({ doctorId: value === 'all' ? null : value })}
      />

      <Tabs<StatusTab>
        items={statusTabs}
        value={statusTab}
        onChange={(next) => updateParams({ status: next === 'All' ? null : next })}
        ariaLabel="Appointment status"
        className="self-start"
      />

      {appointments.error && (
        <ErrorBanner message={appointments.error} onRetry={appointments.reload} />
      )}

      <div
        className={
          appointments.isLoading && appointments.data !== undefined
            ? 'opacity-60 transition-opacity'
            : 'transition-opacity'
        }
      >
        {view === 'list' ? (
          <DataTable
            columns={columns}
            rows={filteredItems}
            rowKey={(row) => String(row.appointmentId)}
            onRowClick={(row) => setSelectedPatientId(row.patientId)}
            rowClassName={listRowClassName}
            loading={isFirstLoad}
            error={appointments.data === undefined ? appointments.error : null}
            onRetry={appointments.reload}
            skeletonRows={8}
            emptyState={
              <EmptyState
                icon="event_busy"
                title="No appointments"
                action={
                  canBook ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon="add"
                      onClick={() => navigate(ROUTES.APPOINTMENT_BOOKING)}
                    >
                      Book appointment
                    </Button>
                  ) : undefined
                }
              />
            }
            rowActions={(row) => (
              <AppointmentRowActions
                appointment={row}
                role={role}
                onViewPatient={setSelectedPatientId}
                onCancel={setToCancel}
                onOpenConsultation={openConsultation}
              />
            )}
          />
        ) : (
          <AppointmentCalendar
            weekStart={weekStart}
            selectedDate={date}
            todayIso={todayIso()}
            appointments={filteredItems}
            loading={isFirstLoad}
            dayErrors={dayErrors}
            onDayErrorRetry={appointments.reload}
            onSelectDay={handleSelectDay}
            role={role}
            onViewPatient={setSelectedPatientId}
            onCancel={setToCancel}
            onOpenConsultation={openConsultation}
          />
        )}
      </div>

      <CancelAppointmentDrawer
        appointment={toCancel}
        onClose={() => setToCancel(null)}
        onCancelled={() => {
          toast.success('Appointment cancelled');
          appointments.reload();
        }}
      />

      <PatientDetailDrawer
        patientId={selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
      />
    </div>
  );
}
