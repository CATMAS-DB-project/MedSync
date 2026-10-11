import { useMemo, useState } from 'react';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { ChartCard } from '../../../components/charts/ChartCard';
import { RankedBarChart } from '../../../components/charts/RankedBarChart';
import { CHART_COLORS } from '../../../components/charts/chartTheme';
import type { TreatmentFrequencyReportItem } from '../../../services/api/reports';

const PAGE_SIZE = 15;

export interface ReportTreatmentsTabProps {
  data: TreatmentFrequencyReportItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ReportTreatmentsTab({
  data,
  loading,
  error,
  onRetry,
}: ReportTreatmentsTabProps) {
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.treatmentCount - a.treatmentCount),
    [data],
  );

  const totals = useMemo(() => {
    let count = 0;
    const services = new Set<string>();
    for (const row of data) {
      count += row.treatmentCount;
      services.add(row.serviceCode);
    }
    return { count, services: services.size };
  }, [data]);

  const top10 = useMemo(
    () =>
      sorted.slice(0, 10).map((row) => ({
        label: row.treatmentName,
        value: row.treatmentCount,
      })),
    [sorted],
  );

  const columns: DataTableColumn<TreatmentFrequencyReportItem>[] = [
    {
      key: 'treatment',
      header: 'Treatment',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-on-surface">{row.treatmentName}</div>
          <div className="truncate font-mono text-label-md text-on-surface-variant">
            {row.serviceCode}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => <Badge tone="neutral">{row.category}</Badge>,
    },
    {
      key: 'count',
      header: 'Count',
      align: 'right',
      cell: (row) => row.treatmentCount.toLocaleString(),
    },
  ];

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const isLoading = loading && data.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <>
            <div className="h-24 rounded-2xl skeleton" />
            <div className="h-24 rounded-2xl skeleton" />
          </>
        ) : (
          <>
            <StatCard
              label="Treatments performed"
              value={totals.count.toLocaleString()}
              icon="medical_services"
            />
            <StatCard
              label="Distinct services"
              value={totals.services.toLocaleString()}
              icon="category"
            />
          </>
        )}
      </section>

      <ChartCard
        title="Top treatments"
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={top10.length === 0}
        height={Math.max(280, top10.length * 32)}
      >
        <RankedBarChart
          data={top10}
          color={CHART_COLORS.secondary}
          valueFormatter={(v) => v.toLocaleString()}
          height={Math.max(280, top10.length * 32)}
          ariaSummary={`Top ${top10.length} treatments by frequency`}
        />
      </ChartCard>

      <DataTable
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => row.serviceCode}
        loading={isLoading}
        error={data.length === 0 ? error : null}
        onRetry={onRetry}
        skeletonRows={PAGE_SIZE}
        pagination={
          sorted.length > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={sorted.length}
              onPageChange={setPage}
            />
          ) : undefined
        }
      />
    </div>
  );
}
