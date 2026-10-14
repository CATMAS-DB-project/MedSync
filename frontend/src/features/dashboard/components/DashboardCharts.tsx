import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { SegmentedControl } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { ChartCard } from '../../../components/charts/ChartCard';
import { TrendChart } from '../../../components/charts/TrendChart';
import { RankedBarChart } from '../../../components/charts/RankedBarChart';
import { DonutChart } from '../../../components/charts/DonutChart';
import { CHART_COLORS, formatPercent, topNWithOther } from '../../../components/charts/chartTheme';
import { formatCurrency } from '../../../utils/formatters';
import type {
  AppointmentSummaryReportItem,
  DoctorRevenueReportItem,
  InsuranceVsOutOfPocketReport,
} from '../../../services/api/reports';

export interface DashboardChartsProps {
  appointments: AppointmentSummaryReportItem[];
  appointmentsLoading: boolean;
  appointmentsError: string | null;
  appointmentsRetry: () => void;

  revenue: DoctorRevenueReportItem[];
  revenueLoading: boolean;
  revenueError: string | null;
  revenueRetry: () => void;

  insurance: InsuranceVsOutOfPocketReport | null;
  insuranceLoading: boolean;
  insuranceError: string | null;
  insuranceRetry: () => void;

  branchRevenue: DoctorRevenueReportItem[];
  branchRevenueLoading: boolean;
  branchRevenueError: string | null;
  branchRevenueRetry: () => void;
  showBranchesChart: boolean;

  onViewAppointmentsReport: () => void;
  onViewRevenueReport: () => void;
  onViewInsuranceReport: () => void;
  onViewBranchesReport: () => void;
}

type BranchMetric = 'revenue' | 'appointments';

const BRANCH_METRIC_ITEMS: TabItem<BranchMetric>[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'appointments', label: 'Appointments' },
];

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

export function DashboardCharts(props: DashboardChartsProps) {
  const [branchMetric, setBranchMetric] = useState<BranchMetric>('revenue');

  // ---- Appointments trend ----
  const trendData = [...props.appointments]
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
    .map((row) => ({
      appointmentDate: row.appointmentDate,
      completed: row.completedCount,
      scheduled: row.scheduledCount,
      cancelled: row.cancelledCount,
    }));

  // ---- Revenue by doctor (top 8 + Other) ----
  const byDoctor = new Map<number, { name: string; value: number }>();
  for (const row of props.revenue) {
    const current = byDoctor.get(row.doctorStaffId);
    byDoctor.set(row.doctorStaffId, {
      name: current?.name ?? `Dr. ${row.doctorName}`,
      value: (current?.value ?? 0) + row.revenue,
    });
  }
  const revenueItems = topNWithOther(
    [...byDoctor.values()].map((d) => ({ label: d.name, value: d.value })),
    8,
    (item) => item.value,
    (_rest, sum) => ({ label: 'Other', value: sum }),
  ).items;

  // ---- Insurance donut ----
  const insuranceData = props.insurance
    ? [
        {
          label: 'Insurance',
          value: props.insurance.insuranceAmount,
          color: CHART_COLORS.primary,
        },
        {
          label: 'Out of pocket',
          value: props.insurance.outOfPocketAmount,
          color: CHART_COLORS.secondary,
        },
      ]
    : [];
  const insuranceShare =
    props.insurance && props.insurance.subtotalAmount > 0
      ? (props.insurance.insuranceAmount / props.insurance.subtotalAmount) * 100
      : 0;

  // ---- Branches (aggregated from revenue rows) ----
  const byBranch = new Map<number, { name: string; revenue: number; appointments: number }>();
  for (const row of props.branchRevenue) {
    const current = byBranch.get(row.branchId);
    byBranch.set(row.branchId, {
      name: current?.name ?? row.branchName,
      revenue: (current?.revenue ?? 0) + row.revenue,
      appointments: (current?.appointments ?? 0) + row.appointmentCount,
    });
  }
  const branchItems = [...byBranch.values()]
    .map((b) => ({
      label: b.name,
      value: branchMetric === 'revenue' ? b.revenue : b.appointments,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard
        title="Appointments"
        loading={props.appointmentsLoading && props.appointments.length === 0}
        error={props.appointmentsError}
        onRetry={props.appointmentsRetry}
        isEmpty={trendData.length === 0}
        height={300}
        actions={
          <Button variant="ghost" size="sm" onClick={props.onViewAppointmentsReport}>
            View report
          </Button>
        }
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
          height={280}
          ariaSummary="Appointments by day, split into completed, scheduled and cancelled"
        />
      </ChartCard>

      <ChartCard
        title="Revenue by doctor"
        loading={props.revenueLoading && props.revenue.length === 0}
        error={props.revenueError}
        onRetry={props.revenueRetry}
        isEmpty={revenueItems.length === 0}
        height={Math.max(280, revenueItems.length * 32)}
        actions={
          <Button variant="ghost" size="sm" onClick={props.onViewRevenueReport}>
            View report
          </Button>
        }
      >
        <RankedBarChart
          data={revenueItems}
          color={CHART_COLORS.primary}
          valueFormatter={(v) => formatCurrency(v)}
          height={Math.max(280, revenueItems.length * 32)}
          ariaSummary={`Top ${revenueItems.length} doctors by revenue`}
        />
      </ChartCard>

      <ChartCard
        title="Insurance vs out of pocket"
        loading={props.insuranceLoading && !props.insurance}
        error={props.insuranceError}
        onRetry={props.insuranceRetry}
        isEmpty={insuranceData.length === 0 || (props.insurance?.invoiceCount ?? 0) === 0}
        height={320}
        actions={
          <Button variant="ghost" size="sm" onClick={props.onViewInsuranceReport}>
            View report
          </Button>
        }
      >
        <DonutChart
          data={insuranceData}
          centerValue={formatPercent(insuranceShare, 0)}
          centerLabel="Insured"
          valueFormatter={(v) => formatCurrency(v)}
          height={260}
          ariaSummary={`Insurance covers ${formatPercent(insuranceShare, 1)} of the subtotal`}
        />
      </ChartCard>

      {props.showBranchesChart && (
        <ChartCard
          title="Branches"
          loading={props.branchRevenueLoading && props.branchRevenue.length === 0}
          error={props.branchRevenueError}
          onRetry={props.branchRevenueRetry}
          isEmpty={branchItems.length === 0}
          height={Math.max(280, branchItems.length * 32)}
          actions={
            <div className="flex items-center gap-2">
              <SegmentedControl<BranchMetric>
                ariaLabel="Branch metric"
                items={BRANCH_METRIC_ITEMS}
                value={branchMetric}
                onChange={setBranchMetric}
              />
              <Button variant="ghost" size="sm" onClick={props.onViewBranchesReport}>
                View report
              </Button>
            </div>
          }
        >
          <RankedBarChart
            data={branchItems}
            color={branchMetric === 'revenue' ? CHART_COLORS.primary : CHART_COLORS.secondary}
            valueFormatter={
              branchMetric === 'revenue'
                ? (v) => formatCurrency(v)
                : (v) => v.toLocaleString()
            }
            height={Math.max(280, branchItems.length * 32)}
            ariaSummary={`Branches ranked by ${branchMetric === 'revenue' ? 'revenue' : 'appointments'}`}
          />
        </ChartCard>
      )}
    </section>
  );
}
