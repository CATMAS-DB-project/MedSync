import { StatCard } from '../../../components/ui/StatCard';
import { ChartCard } from '../../../components/charts/ChartCard';
import { DonutChart } from '../../../components/charts/DonutChart';
import { CHART_COLORS, formatPercent } from '../../../components/charts/chartTheme';
import { formatCurrency } from '../../../utils/formatters';
import type { InsuranceVsOutOfPocketReport } from '../../../services/api/reports';

export interface ReportInsuranceTabProps {
  data: InsuranceVsOutOfPocketReport | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ReportInsuranceTab({
  data,
  loading,
  error,
  onRetry,
}: ReportInsuranceTabProps) {
  const isLoading = loading && data === null;
  const isEmpty = !data || data.invoiceCount === 0;

  const share =
    data && data.subtotalAmount > 0
      ? (data.insuranceAmount / data.subtotalAmount) * 100
      : 0;

  const donutData = data
    ? [
        {
          label: 'Insurance',
          value: data.insuranceAmount,
          color: CHART_COLORS.primary,
        },
        {
          label: 'Out of pocket',
          value: data.outOfPocketAmount,
          color: CHART_COLORS.secondary,
        },
      ]
    : [];

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
              label="Invoices"
              value={data ? data.invoiceCount.toLocaleString() : '—'}
              icon="receipt_long"
            />
            <StatCard
              label="Subtotal"
              value={data ? formatCurrency(data.subtotalAmount) : '—'}
              icon="payments"
            />
            <StatCard
              label="Insurance"
              value={data ? formatCurrency(data.insuranceAmount) : '—'}
              icon="health_and_safety"
            />
            <StatCard
              label="Out of pocket"
              value={data ? formatCurrency(data.outOfPocketAmount) : '—'}
              icon="account_balance_wallet"
            />
          </>
        )}
      </section>

      <ChartCard
        title="Insurance vs out-of-pocket"
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={isEmpty}
        height={320}
      >
        <DonutChart
          data={donutData}
          centerValue={formatPercent(share, 0)}
          centerLabel="Insured"
          valueFormatter={(v) => formatCurrency(v)}
          height={260}
          ariaSummary={`Insurance covers ${formatPercent(share, 1)} of subtotal`}
        />
      </ChartCard>
    </div>
  );
}
