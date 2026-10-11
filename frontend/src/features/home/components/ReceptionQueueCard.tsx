import { useMemo, useState } from 'react';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { IconButton } from '../../../components/ui/IconButton';
import { DropdownMenu } from '../../../components/ui/DropdownMenu';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import type { Appointment, AppointmentStatus } from '../../../types';

type QueueTab = 'All' | AppointmentStatus;

export interface ReceptionQueueCardProps {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
  onViewPatient: (patientId: number) => void;
  onCancel: (appointment: Appointment) => void;
}

export function ReceptionQueueCard({
  appointments,
  isLoading,
  error,
  onRetry,
  onRefresh,
  lastUpdated,
  onViewPatient,
  onCancel,
}: ReceptionQueueCardProps) {
  const [activeTab, setActiveTab] = useState<QueueTab>('All');

  const counts = useMemo(
    () => ({
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === 'Scheduled').length,
      completed: appointments.filter((a) => a.status === 'Completed').length,
      cancelled: appointments.filter((a) => a.status === 'Cancelled').length,
    }),
    [appointments],
  );

  const sorted = useMemo(
    () =>
      [...appointments].sort((a, b) =>
        a.appointmentTime.localeCompare(b.appointmentTime),
      ),
    [appointments],
  );

  const filtered = useMemo(
    () => (activeTab === 'All' ? sorted : sorted.filter((a) => a.status === activeTab)),
    [sorted, activeTab],
  );

  const nextUpcomingId = useMemo(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nowTime = `${hh}:${mm}`;
    const next = sorted.find(
      (a) => a.status === 'Scheduled' && a.appointmentTime >= nowTime,
    );
    return next?.appointmentId ?? null;
  }, [sorted]);

  const tabItems: TabItem<QueueTab>[] = [
    { value: 'All', label: `All (${counts.total})` },
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
      cell: (row) => {
        const isNext = row.appointmentId === nextUpcomingId;
        return (
          <span className="inline-flex items-center gap-2">
            <span>{formatTime(row.appointmentTime)}</span>
            {isNext && (
              <span className="text-label-sm font-semibold uppercase tracking-wider text-primary">
                Next
              </span>
            )}
          </span>
        );
      },
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

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Loading…';
    const hh = String(lastUpdated.getHours()).padStart(2, '0');
    const mm = String(lastUpdated.getMinutes()).padStart(2, '0');
    return `Updated ${formatTime(`${hh}:${mm}`)}`;
  }, [lastUpdated]);

  const isRefreshing = isLoading && appointments.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-headline-sm text-on-surface">Today&apos;s queue</h2>
        <div className="flex items-center gap-2">
          <span className="text-label-md text-on-surface-variant">{updatedLabel}</span>
          <IconButton
            icon={isRefreshing ? 'progress_activity' : 'refresh'}
            size="sm"
            aria-label="Refresh queue"
            onClick={onRefresh}
            className={cn(isRefreshing && 'animate-spin')}
          />
        </div>
      </header>

      <Tabs<QueueTab>
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Queue filter"
      />

      {error && appointments.length > 0 && (
        <ErrorBanner message={error} onRetry={onRetry} />
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => String(row.appointmentId)}
        rowClassName={(row) =>
          row.appointmentId === nextUpcomingId ? 'bg-primary-container/30' : undefined
        }
        loading={isLoading && appointments.length === 0}
        error={appointments.length === 0 ? error : null}
        onRetry={onRetry}
        emptyState={
          appointments.length === 0 ? (
            <EmptyState icon="event_available" title="No appointments today" />
          ) : (
            <EmptyState icon="filter_alt_off" title="No appointments match this filter" />
          )
        }
        rowActions={(row) => (
          <DropdownMenu
            ariaLabel="Appointment actions"
            trigger={<IconButton icon="more_horiz" size="sm" aria-label="Actions" />}
            items={[
              {
                id: 'view-patient',
                label: 'View patient',
                icon: 'person',
                onSelect: () => onViewPatient(row.patientId),
              },
              ...(row.status === 'Scheduled'
                ? [
                    {
                      id: 'cancel',
                      label: 'Cancel appointment',
                      icon: 'event_busy',
                      danger: true,
                      onSelect: () => onCancel(row),
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
    </section>
  );
}
