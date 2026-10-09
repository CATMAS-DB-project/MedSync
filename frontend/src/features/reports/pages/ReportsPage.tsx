import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchBranches } from '../../../services/api/branches';
import {
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
  fetchInsuranceVsOutOfPocket,
  fetchOutstandingBalances,
  fetchTreatmentFrequency,
} from '../../../services/api/reports';
import { formatCurrency } from '../../../utils/formatters';
import { toIsoDate, todayIso } from '../../../utils/dates';

interface Filters {
  branch: string; // 'all' or a branch id
  from: string;
  to: string;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SectionCard({
  title,
  subtitle,
  error,
  loading,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  error: string | null;
  loading: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex justify-between items-center border-b border-outline-variant pb-2">
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        {subtitle && <span className="text-body-sm text-on-surface-variant">{subtitle}</span>}
      </div>
      {error ? (
        <p className="text-body-sm text-error">{error}</p>
      ) : loading ? (
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      ) : (
        children
      )}
    </div>
  );
}

export function ReportsPage() {
  const { currentUser } = useAuth();
  const isBranchManager = currentUser?.role === 'Branch Manager';

  const initial: Filters = { branch: 'all', from: daysAgoIso(29), to: todayIso() };
  const [draft, setDraft] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  const [filterError, setFilterError] = useState<string | null>(null);

  const branches = useAsync(() => fetchBranches(1, 100), []);

  // Branch Managers are locked to their own branch by the backend.
  const branchId = isBranchManager
    ? currentUser?.branchId
    : applied.branch === 'all'
      ? undefined
      : Number(applied.branch);
  const range = { from: applied.from, to: applied.to };

  const volume = useAsync(() => fetchAppointmentsSummary({ branchId, ...range }), [branchId, applied.from, applied.to]);
  const revenue = useAsync(() => fetchDoctorRevenue({ branchId, ...range }), [branchId, applied.from, applied.to]);
  const outstanding = useAsync(() => fetchOutstandingBalances({ branchId }), [branchId]);
  const treatments = useAsync(() => fetchTreatmentFrequency(range), [applied.from, applied.to]);
  const insurance = useAsync(() => fetchInsuranceVsOutOfPocket({ branchId, ...range }), [branchId, applied.from, applied.to]);

  function applyFilters() {
    if (!draft.from || !draft.to) return setFilterError('Choose both a start and end date.');
    if (draft.from > draft.to) return setFilterError('The start date must be on or before the end date.');
    setFilterError(null);
    setApplied(draft);
  }

  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({ label: b.branchName, value: String(b.branchId) })),
  ];

  // Appointment volume bars (most recent 31 days of the range)
  const volumeRows = (volume.data ?? []).slice(-31);
  const maxVolume = Math.max(1, ...volumeRows.map((d) => d.totalCount));

  // Revenue by provider
  const revenueRows = [...(revenue.data ?? [])].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const maxRevenue = Math.max(1, ...revenueRows.map((r) => Number(r.revenue)));

  // Outstanding balances
  const outstandingRows = outstanding.data ?? [];
  const outstandingTotal = outstandingRows.reduce((s, r) => s + Number(r.outstandingAmount), 0);

  // Insurance split
  const ins = insurance.data;
  const insuranceShare = ins && Number(ins.subtotalAmount) > 0 ? (Number(ins.insuranceAmount) / Number(ins.subtotalAmount)) * 100 : 0;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Report period', `${applied.from} to ${applied.to}`],
      [],
      ['Appointments by day'],
      ['Date', 'Total', 'Scheduled', 'Completed', 'Cancelled'],
      ...(volume.data ?? []).map((d) => [d.appointmentDate.slice(0, 10), d.totalCount, d.scheduledCount, d.completedCount, d.cancelledCount]),
      [],
      ['Revenue by provider'],
      ['Branch', 'Doctor', 'Appointments', 'Revenue', 'Rank in branch'],
      ...revenueRows.map((r) => [r.branchName, r.doctorName, r.appointmentCount, Number(r.revenue), r.revenueRank]),
      [],
      ['Outstanding balances'],
      ['Invoice', 'Patient', 'Branch', 'Payable', 'Paid', 'Outstanding'],
      ...outstandingRows.map((r) => [r.invoiceId, r.patientName, r.branchName, Number(r.payableAmount), Number(r.amountPaid), Number(r.outstandingAmount)]),
      [],
      ['Treatment frequency'],
      ['Service code', 'Treatment', 'Category', 'Count'],
      ...(treatments.data ?? []).map((t) => [t.serviceCode, t.treatmentName, t.category, t.treatmentCount]),
    ];
    downloadCsv(`catms-report-${applied.from}-to-${applied.to}.csv`, rows);
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-on-surface">Reports</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Key performance metrics and financial overviews.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="primary" icon="print" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
          <Button variant="secondary" icon="table_view" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-wrap gap-4 items-end print:hidden">
        {!isBranchManager && (
          <div className="flex-1 min-w-[200px]">
            <Select
              label="Branch Location"
              options={branchOptions}
              value={draft.branch}
              onChange={(event) => setDraft({ ...draft, branch: event.target.value })}
            />
          </div>
        )}
        <div className="min-w-[160px]">
          <Input label="From" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="min-w-[160px]">
          <Input label="To" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <Button variant="secondary" onClick={applyFilters}>
          Apply Filters
        </Button>
        {filterError && <p className="w-full text-body-sm text-error">{filterError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SectionCard
          title="Appointment Volume"
          subtitle={`${applied.from} → ${applied.to}`}
          error={volume.error}
          loading={volume.isLoading && !volume.data}
          className="col-span-1 lg:col-span-2"
        >
          {volumeRows.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No appointments in this period.</p>
          ) : (
            <div className="flex items-end justify-between gap-1 pt-4 pb-2 h-48">
              {volumeRows.map((day, index) => {
                const iso = day.appointmentDate.slice(0, 10);
                const isPeak = day.totalCount === maxVolume;
                const showLabel = volumeRows.length <= 12 || index % 5 === 0;
                return (
                  <div key={iso} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                    <div
                      className={`w-full rounded-t ${isPeak ? 'bg-primary-container' : 'bg-primary-container/40'}`}
                      style={{ height: `${Math.max(6, (day.totalCount / maxVolume) * 100)}%` }}
                      title={`${iso}: ${day.totalCount} total · ${day.completedCount} completed · ${day.cancelledCount} cancelled`}
                    />
                    <span className="text-label-md text-on-surface-variant h-4 whitespace-nowrap">
                      {showLabel ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Insurance vs Out-of-Pocket"
          error={insurance.error}
          loading={insurance.isLoading && !insurance.data}
        >
          {ins && (
            <div className="flex flex-col gap-3">
              <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${insuranceShare}%` }} />
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-on-surface-variant">Insurance</span>
                <span className="font-semibold text-on-surface">{formatCurrency(Number(ins.insuranceAmount))}</span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-on-surface-variant">Out-of-pocket</span>
                <span className="font-semibold text-on-surface">{formatCurrency(Number(ins.outOfPocketAmount))}</span>
              </div>
              <div className="flex justify-between text-body-sm border-t border-outline-variant pt-2">
                <span className="text-on-surface-variant">{ins.invoiceCount} invoices · subtotal</span>
                <span className="font-semibold text-on-surface">{formatCurrency(Number(ins.subtotalAmount))}</span>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Revenue by Provider"
          subtitle="Payable amount, grouped by doctor"
          error={revenue.error}
          loading={revenue.isLoading && !revenue.data}
          className="col-span-1 lg:col-span-3"
        >
          {revenueRows.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No revenue in this period.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {revenueRows.map((row) => (
                <div key={`${row.branchId}-${row.doctorStaffId}`} className="flex items-center gap-4">
                  <div className="w-48 truncate text-body-sm text-on-surface" title={`${row.doctorName} · ${row.branchName}`}>
                    Dr. {row.doctorName}
                    <span className="block text-label-md text-on-surface-variant">{row.branchName}</span>
                  </div>
                  <div className="bg-surface-container-high h-6 rounded flex-1 overflow-hidden">
                    <div
                      className="bg-primary-container h-full flex items-center px-2 text-on-primary-container text-xs font-medium whitespace-nowrap"
                      style={{ width: `${Math.max(8, (Number(row.revenue) / maxRevenue) * 100)}%` }}
                    >
                      {formatCurrency(Number(row.revenue))} · {row.appointmentCount} visits
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Outstanding Balances"
          subtitle={`${formatCurrency(outstandingTotal)} · ${outstandingRows.length} invoices`}
          error={outstanding.error}
          loading={outstanding.isLoading && !outstanding.data}
          className="col-span-1 lg:col-span-2"
        >
          {outstandingRows.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No outstanding balances.</p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead className="text-label-md text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="py-1.5">Patient</th>
                    <th className="py-1.5">Branch</th>
                    <th className="py-1.5 text-right">Payable</th>
                    <th className="py-1.5 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingRows.map((row) => (
                    <tr key={row.invoiceId} className="border-b border-outline-variant">
                      <td className="py-1.5 text-on-surface">
                        {row.patientName}
                        <span className="ml-2 font-mono text-xs text-on-surface-variant">#{row.invoiceId}</span>
                      </td>
                      <td className="py-1.5 text-on-surface-variant">{row.branchName}</td>
                      <td className="py-1.5 text-right">{formatCurrency(Number(row.payableAmount))}</td>
                      <td className="py-1.5 text-right font-semibold">{formatCurrency(Number(row.outstandingAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top Treatments"
          subtitle={isBranchManager ? 'Your branch' : 'All branches'}
          error={treatments.error}
          loading={treatments.isLoading && !treatments.data}
        >
          {(treatments.data ?? []).length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No treatments in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-body-sm">
              {(treatments.data ?? []).slice(0, 10).map((t) => (
                <li key={t.serviceCode} className="flex items-center justify-between gap-2">
                  <span className="text-on-surface truncate">
                    {t.treatmentName}
                    <span className="block text-label-md text-on-surface-variant">{t.category}</span>
                  </span>
                  <span className="font-semibold text-on-surface">{t.treatmentCount}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
