import { useMemo, useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { InvoiceDetailDrawer } from '../components/InvoiceDetailDrawer';
import { mockInvoices } from '../../../services/mock/invoices';
import { mockPayments } from '../../../services/mock/payments';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { calculateOutstandingBalance, calculatePayableAmount } from '../../../utils/billing';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import type { Invoice, InvoiceStatus } from '../../../types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Finalized', value: 'Finalized' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Partially Paid', value: 'Partially Paid' },
];

export function BillingPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    return mockInvoices.filter((invoice) => {
      const matchesQuery =
        query.trim() === '' ||
        (invoice.patientName ?? '').toLowerCase().includes(query.toLowerCase()) ||
        String(invoice.invoiceId).includes(query);
      const matchesStatus = status === 'all' || invoice.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Outstanding = payable minus paid, for every invoice that isn't fully Paid.
  const outstandingTotal = mockInvoices
    .filter((invoice) => invoice.status !== 'Paid')
    .reduce((sum, invoice) => sum + calculateOutstandingBalance(invoice, mockPayments), 0);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Billing Queue</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {formatCurrency(outstandingTotal)} outstanding across all branches
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search by patient or invoice number..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
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
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-1/4">
                  Patient
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Invoice #
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Created
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Branch
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold text-right">
                  Payable
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {paginated.map((invoice) => (
                <tr
                  key={invoice.invoiceId}
                  onClick={() => setSelectedInvoice(invoice)}
                  className="hover:bg-[#EDF2F7] cursor-pointer transition-colors h-9"
                >
                  <td className="py-1.5 px-3 font-medium">{invoice.patientName}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant font-mono text-xs">
                    #{invoice.invoiceId}
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{invoice.branchName}</td>
                  <td className="py-1.5 px-3 text-right font-medium">
                    {formatCurrency(calculatePayableAmount(invoice))}
                  </td>
                  <td className="py-1.5 px-3">
                    <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No invoices match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <InvoiceDetailDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
}
