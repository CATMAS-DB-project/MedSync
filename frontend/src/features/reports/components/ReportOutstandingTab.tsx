import { useMemo, useState } from 'react';
import { StatCard } from '../../../components/ui/StatCard';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { ChartCard } from '../../../components/charts/ChartCard';
import { RankedBarChart } from '../../../components/charts/RankedBarChart';
import { CHART_COLORS } from '../../../components/charts/chartTheme';
import { formatCurrency } from '../../../utils/formatters';
import type { OutstandingBalanceReportItem } from '../../../services/api/reports';

const PAGE_SIZE = 15;

export interface ReportOutstandingTabProps {
  data: OutstandingBalanceReportItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenInvoice: (invoiceId: number) => void;
}

export function ReportOutstandingTab({
  data,
  loading,
  error,
  onRetry,
  onOpenInvoice,
}: ReportOutstandingTabProps) {
  const [page, setPage] = useState(1);

  const totals = useMemo(() => {
    let outstanding = 0;
    const patients = new Set<number>();
    for (const row of data) {
      outstanding += row.outstandingAmount;
      patients.add(row.patientId);
    }
    return { outstanding, invoices: data.length, patients: patients.size };
  }, [data]);

  const top8 = useMemo(() => {
    const byPatient = new Map<number, { name: string; value: number }>();
    for (const row of data) {
      const current = byPatient.get(row.patientId);
      byPatient.set(row.patientId, {
        name: current?.name ?? row.patientName,
        value: (current?.value ?? 0) + row.outstandingAmount,
      });
    }
    return [...byPatient.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((p) => ({ label: p.name, value: p.value }));
  }, [data]);

  const columns: DataTableColumn<OutstandingBalanceReportItem>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      primary: true,
      cell: (row) => <span className="font-mono">#{row.invoiceId}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      secondary: true,
      cell: (row) => row.patientName,
    },
    {
      key: 'branch',
      header: 'Branch',
      hideOnMobile: true,
      cell: (row) => row.branchName,
    },
    {
      key: 'payable',
      header: 'Payable',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.payableAmount),
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.amountPaid),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-error">
          {formatCurrency(row.outstandingAmount)}
        </span>
      ),
    },
  ];

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, page]);

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
              label="Total outstanding"
              value={formatCurrency(totals.outstanding)}
              icon="account_balance_wallet"
            />
            <StatCard
              label="Invoices"
              value={totals.invoices.toLocaleString()}
              icon="receipt_long"
            />
            <StatCard
              label="Patients with balance"
              value={totals.patients.toLocaleString()}
              icon="group"
            />
          </>
        )}
      </section>

      <ChartCard
        title="Top patients by outstanding"
        loading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={top8.length === 0}
        height={Math.max(280, top8.length * 32)}
      >
        <RankedBarChart
          data={top8}
          color={CHART_COLORS.error}
          valueFormatter={(v) => formatCurrency(v)}
          height={Math.max(280, top8.length * 32)}
          ariaSummary={`Top ${top8.length} patients by outstanding balance`}
        />
      </ChartCard>

      <DataTable
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => String(row.invoiceId)}
        onRowClick={(row) => onOpenInvoice(row.invoiceId)}
        loading={isLoading}
        error={data.length === 0 ? error : null}
        onRetry={onRetry}
        skeletonRows={PAGE_SIZE}
        pagination={
          data.length > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.length}
              onPageChange={setPage}
            />
          ) : undefined
        }
      />
    </div>
  );
}
