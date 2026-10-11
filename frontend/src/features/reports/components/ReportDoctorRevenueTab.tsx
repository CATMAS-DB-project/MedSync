import { useMemo } from 'react';
import { StatCard } from '../../../components/ui/StatCard';
import { Avatar } from '../../../components/ui/Avatar';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { ChartCard } from '../../../components/charts/ChartCard';
import { RankedBarChart } from '../../../components/charts/RankedBarChart';
import { CHART_COLORS } from '../../../components/charts/chartTheme';
import { formatCurrency } from '../../../utils/formatters';
import type { DoctorRevenueReportItem } from '../../../services/api/reports';

export interface ReportDoctorRevenueTabProps {
  data: DoctorRevenueReportItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ReportDoctorRevenueTab({
  data,
  loading,
  error,
  onRetry,
}: ReportDoctorRevenueTabProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => a.revenueRank - b.revenueRank),
    [data],
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let appointments = 0;
    for (const row of data) {
      revenue += row.revenue;
      appointments += row.appointmentCount;
    }
    const doctors = new Set(data.map((d) => d.doctorStaffId)).size;
    return { revenue, appointments, doctors };
  }, [data]);

  const top8 = useMemo(() => {
    const byDoctor = new Map<number, { name: string; value: number }>();
    for (const row of data) {
      const current = byDoctor.get(row.doctorStaffId);
      byDoctor.set(row.doctorStaffId, {
        name: current?.name ?? `Dr. ${row.doctorName}`,
        value: (current?.value ?? 0) + row.revenue,
      });
    }
    return [...byDoctor.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((d) => ({ label: d.name, value: d.value }));
  }, [data]);

  const columns: DataTableColumn<DoctorRevenueReportItem>[] = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'right',
      cell: (row) => row.revenueRank.toLocaleString(),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={row.doctorName} size="xs" />
          <span className="truncate">Dr. {row.doctorName}</span>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      secondary: true,
      cell: (row) => row.branchName,
    },
    {
      key: 'appointments',
      header: 'Appointments',
      align: 'right',
      cell: (row) => row.appointmentCount.toLocaleString(),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      cell: (row) => formatCurrency(row.revenue),
    },
  ];

  const isLoading = loading && data.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 md:grid-cols-3">
        {isLoading ? (
          <>
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
          </>
        ) : (
          <>
            <StatCard
              label="Total revenue"
              value={formatCurrency(totals.revenue)}
              icon="payments"
            />
            <StatCard
              label="Appointments"
              value={totals.appointments.toLocaleString()}
              icon="event_note"
            />
            <StatCard
              label="Doctors"
              value={totals.doctors.toLocaleString()}
              icon="stethoscope"
            />
          </>
        )}
      </section>

      <ChartCard
        title="Revenue by doctor"
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={top8.length === 0}
        height={Math.max(280, top8.length * 32)}
      >
        <RankedBarChart
          data={top8}
          color={CHART_COLORS.primary}
          valueFormatter={(v) => formatCurrency(v)}
          height={Math.max(280, top8.length * 32)}
          ariaSummary={`Top ${top8.length} doctors by revenue`}
        />
      </ChartCard>

      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(row) => `${row.branchId}-${row.doctorStaffId}`}
        loading={isLoading}
        error={data.length === 0 ? error : null}
        onRetry={onRetry}
        skeletonRows={6}
      />
    </div>
  );
}
