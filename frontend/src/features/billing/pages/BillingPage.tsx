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
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div>
        <h2 className="text-display-sm text-on-surface">Billing Queue</h2>
        <p className="text-body-sm text-on-surface-variant mt-1">
          {total} invoice{total === 1 ? '' : 's'} match the current filters
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-56">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceStatus | 'all');
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <Select
            options={branchOptions}
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        {invoices.error && (
          <div className="px-4 py-3 bg-error/10 text-error text-body-sm flex items-center justify-between">
            <span>{invoices.error}</span>
            <button type="button" className="underline" onClick={invoices.reload}>
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Invoice #</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-1/4">Patient</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Branch</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold text-right">Payable</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold text-right">Outstanding</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {rows.map((invoice) => (
                <tr
                  key={invoice.invoiceId}
                  onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                  className="hover:bg-surface-container-high cursor-pointer transition-colors h-9"
                >
                  <td className="py-1.5 px-3 text-on-surface-variant font-mono text-xs">#{invoice.invoiceId}</td>
                  <td className="py-1.5 px-3 font-medium">
                    {invoice.patientName ?? `Patient #${invoice.patientId ?? '—'}`}
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {invoice.branchName ?? branchName(invoice.branchId)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-medium">
                    {formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-on-surface-variant">
                    {invoice.status === 'Draft' ? '—' : formatCurrency(invoice.outstandingAmount ?? 0)}
                  </td>
                  <td className="py-1.5 px-3">
                    <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                  </td>
                </tr>
              ))}
              {!invoices.isLoading && !invoices.error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No invoices found.
                  </td>
                </tr>
              )}
              {invoices.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    Loading invoices…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
      </div>

      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={closeDrawer}
        onChanged={invoices.reload}
      />
    </div>
  );
}
