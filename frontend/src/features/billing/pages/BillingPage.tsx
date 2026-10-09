import { useCallback, useState } from 'react';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchBranches } from '../../../services/api/branches';
import { fetchInvoices } from '../../../services/api/invoices';
import { formatCurrency } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import { InvoiceDetailDrawer } from '../components/InvoiceDetailDrawer';
import type { InvoiceStatus } from '../../../types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Finalized', value: 'Finalized' },
  { label: 'Partially Paid', value: 'Partially Paid' },
  { label: 'Paid', value: 'Paid' },
];

export function BillingPage() {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [branchId, setBranchId] = useState(
    currentUser?.role === 'Receptionist' ? String(currentUser.branchId) : 'all',
  );
  const [page, setPage] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const invoices = useAsync(
    () =>
      fetchInvoices({
        status: status === 'all' ? undefined : status,
        branchId: branchId === 'all' ? undefined : Number(branchId),
        page,
        pageSize: PAGE_SIZE,
      }),
    [status, branchId, page],
  );

  const branchName = (id?: number) =>
    branches.data?.items.find((b) => b.branchId === id)?.branchName ?? '—';
  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({ label: b.branchName, value: String(b.branchId) })),
  ];

  const rows = invoices.data?.items ?? [];
  const total = invoices.data?.total ?? 0;
  const closeDrawer = useCallback(() => setSelectedInvoiceId(null), []);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated backdrop-blur-sm">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">receipt_long</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Payments &amp; invoices</p>
            <h2 className="text-display-sm text-white">Billing Queue</h2>
            <p className="mt-1 text-body-sm text-white/80">
              Review invoice status and outstanding balances
            </p>
          </div>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_14rem] sm:items-end sm:p-5">
          <div className="flex items-center gap-3 sm:pb-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">filter_alt</span>
            </span>
            <div>
              <h3 className="text-body-md font-semibold text-on-surface">Filter invoices</h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Narrow the queue by status or branch.</p>
            </div>
          </div>
          <Select
            label="Invoice status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | 'all');
              setPage(1);
            }}
          />
          <Select
            label="Branch"
            options={branchOptions}
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-headline-sm text-on-surface">Invoice directory</h3>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-md font-medium text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">receipt</span>
              {total.toLocaleString()} {total === 1 ? 'invoice' : 'invoices'} match the current filters
            </div>
          </div>
          {invoices.isLoading && (
            <span className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant" role="status">
              <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">progress_activity</span>
              Loading invoices
            </span>
          )}
        </div>

        {invoices.error && (
          <div role="alert" className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-lg border border-error/30 bg-error-container/50 px-4 py-3 text-body-sm text-on-error-container">
            <span>{invoices.error}</span>
            <button type="button" className="shrink-0 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error" onClick={invoices.reload}>
              Retry
            </button>
          </div>
        )}

        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-primary-fixed/30">
              <tr>
                <th scope="col" className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Invoice</th>
                <th scope="col" className="w-1/4 px-4 py-3 text-label-md font-semibold text-on-surface-variant">Patient</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Branch</th>
                <th scope="col" className="px-4 py-3 text-right text-label-md font-semibold text-on-surface-variant">Payable</th>
                <th scope="col" className="px-4 py-3 text-right text-label-md font-semibold text-on-surface-variant">Outstanding</th>
                <th scope="col" className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface">
              {rows.map((invoice) => (
                <tr
                  key={invoice.invoiceId}
                  onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                  className="h-16 cursor-pointer odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25 focus-within:bg-primary-fixed/25"
                >
                  <td className="px-5 py-3 font-mono text-xs text-primary">#{invoice.invoiceId}</td>
                  <td className="px-4 py-3 font-semibold text-on-surface">
                    {invoice.patientName ?? `Patient #${invoice.patientId ?? '—'}`}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {invoice.branchName ?? branchName(invoice.branchId)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-on-surface">
                    {formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-on-surface-variant">
                    {invoice.status === 'Draft' ? '—' : formatCurrency(invoice.outstandingAmount ?? 0)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                  </td>
                </tr>
              ))}
              {!invoices.isLoading && !invoices.error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                    No invoices found.
                  </td>
                </tr>
              )}
              {invoices.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-primary" aria-hidden="true">progress_activity</span>
                      Loading invoices…
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-outline-variant">
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
        </div>
      </section>

      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={closeDrawer}
        onChanged={invoices.reload}
      />
    </div>
  );
}
