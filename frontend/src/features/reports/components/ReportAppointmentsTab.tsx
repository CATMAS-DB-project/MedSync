import { useMemo, useState } from 'react';
import { StatCard } from '../../../components/ui/StatCard';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { ChartCard } from '../../../components/charts/ChartCard';
import { TrendChart } from '../../../components/charts/TrendChart';
import { CHART_COLORS, formatPercent } from '../../../components/charts/chartTheme';
import type { AppointmentSummaryReportItem } from '../../../services/api/reports';

const PAGE_SIZE = 15;

export interface ReportAppointmentsTabProps {
  data: AppointmentSummaryReportItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function ReportAppointmentsTab({
  data,
  loading,
  error,
  onRetry,
}: ReportAppointmentsTabProps) {
  const [page, setPage] = useState(1);

  const totals = useMemo(() => {
    let total = 0;
    let completed = 0;
    let scheduled = 0;
    let cancelled = 0;
    for (const row of data) {
      total += row.totalCount;
      completed += row.completedCount;
      scheduled += row.scheduledCount;
      cancelled += row.cancelledCount;
    }
    return { total, completed, scheduled, cancelled };
  }, [data]);

  const completionRate = totals.total > 0 ? (totals.completed / totals.total) * 100 : 0;

  const trendData = useMemo(
    () =>
      [...data]
        .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
        .map((row) => ({
          appointmentDate: row.appointmentDate,
          total: row.totalCount,
          completed: row.completedCount,
          scheduled: row.scheduledCount,
          cancelled: row.cancelledCount,
        })),
    [data],
  );

  const tableRows = useMemo(
    () =>
      [...data].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)),
    [data],
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [tableRows, page]);

  const columns: DataTableColumn<AppointmentSummaryReportItem>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      cell: (row) => formatShortDate(row.appointmentDate),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (row) => row.totalCount.toLocaleString(),
    },
    {
      key: 'completed',
      header: 'Completed',
      align: 'right',
      cell: (row) => row.completedCount.toLocaleString(),
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      align: 'right',
      cell: (row) => row.scheduledCount.toLocaleString(),
    },
    {
      key: 'cancelled',
      header: 'Cancelled',
      align: 'right',
      cell: (row) => row.cancelledCount.toLocaleString(),
    },
  ];

  const isLoading = loading && data.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
          </>
        ) : (
          <>
            <StatCard
              label="Total"
              value={totals.total.toLocaleString()}
              icon="event_note"
            />
            <StatCard
              label="Completed"
              value={totals.completed.toLocaleString()}
              icon="task_alt"
              description={`${formatPercent(completionRate, 1)} completion`}
            />
            <StatCard
              label="Scheduled"
              value={totals.scheduled.toLocaleString()}
              icon="schedule"
            />
            <StatCard
              label="Cancelled"
              value={totals.cancelled.toLocaleString()}
              icon="event_busy"
            />
          </>
        )}
      </section>

      <ChartCard
        title="Daily trend"
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={data.length === 0}
        height={300}
      >
        <TrendChart
          data={trendData}
          xKey="appointmentDate"
          stacked
          series={[
            { key: 'completed', label: 'Completed', color: CHART_COLORS.success },
            { key: 'scheduled', label: 'Scheduled', color: CHART_COLORS.primary },
            { key: 'cancelled', label: 'Cancelled', color: CHART_COLORS.error },
          ]}
          labelFormatter={(v) => formatShortDate(String(v))}
          valueFormatter={(v) => v.toLocaleString()}
          ariaSummary={`Daily appointment trend across ${data.length} days`}
        />
      </ChartCard>

      <DataTable
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => row.appointmentDate}
        loading={isLoading}
        error={data.length === 0 ? error : null}
        onRetry={onRetry}
        skeletonRows={PAGE_SIZE}
        pagination={
          tableRows.length > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={tableRows.length}
              onPageChange={setPage}
            />
          ) : undefined
        }
      />
    </div>
  );
}
