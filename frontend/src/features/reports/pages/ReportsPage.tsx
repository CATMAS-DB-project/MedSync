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
import { todayIso, daysAgoIso } from '../../../utils/dates';

interface Filters {
  branch: string; // 'all' or a branch id
  from: string;
  to: string;
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
    <div className={`relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated sm:p-5 ${className}`}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-secondary" />
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-outline-variant pb-3 pt-1">
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated md:flex-row md:items-center md:justify-between md:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated backdrop-blur-sm">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">monitoring</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Insights &amp; performance</p>
            <h1 className="text-display-sm text-white">Reports</h1>
            <p className="mt-1 text-body-sm text-white/80">
              Key performance metrics and financial overviews
            </p>
          </div>
        </div>
        <div className="relative z-10 flex flex-col gap-2 print:hidden sm:flex-row">
          <Button
            variant="secondary"
            icon="print"
            onClick={() => window.print()}
            className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
          >
            Print / Save PDF
          </Button>
          <Button
            variant="primary"
            icon="table_view"
            onClick={exportCsv}
            className="w-full bg-white text-primary shadow-lg hover:bg-secondary hover:text-on-secondary sm:w-auto"
          >
            Export CSV
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated print:hidden">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
            </span>
            <div>
              <h2 className="text-body-md font-semibold text-on-surface">Report filters</h2>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Set a reporting period and branch, then apply your selection.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_auto] lg:items-end">
            {!isBranchManager && (
              <Select
                label="Branch location"
                options={branchOptions}
                value={draft.branch}
                onChange={(event) => setDraft({ ...draft, branch: event.target.value })}
              />
            )}
            <Input label="From" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            <Input label="To" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            <Button variant="primary" icon="filter_alt" onClick={applyFilters} className="w-full sm:w-auto">
              Apply Filters
            </Button>
            {filterError && (
              <p role="alert" className="text-body-sm text-error sm:col-span-2 lg:col-span-full">
                {filterError}
              </p>
            )}
          </div>
        </div>
      </section>

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
