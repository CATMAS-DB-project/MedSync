import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatCurrency } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../../billing/statusStyles';
import type { Invoice } from '../../../types';
import type { OutstandingBalanceReportItem } from '../../../services/api/reports';

export type BillingTab = 'Drafts' | 'Balance due';

export interface ReceptionBillingCardProps {
  drafts: Invoice[];
  draftsLoading: boolean;
  draftsError: string | null;
  onDraftsRetry: () => void;
  balances: OutstandingBalanceReportItem[];
  balancesLoading: boolean;
  balancesError: string | null;
  onBalancesRetry: () => void;
  onViewInvoice: (invoiceId: number) => void;
  onViewAll: (tab: BillingTab) => void;
}

export function ReceptionBillingCard({
  drafts,
  draftsLoading,
  draftsError,
  onDraftsRetry,
  balances,
  balancesLoading,
  balancesError,
  onBalancesRetry,
  onViewInvoice,
  onViewAll,
}: ReceptionBillingCardProps) {
  const [tab, setTab] = useState<BillingTab>('Drafts');

  const tabItems: TabItem<BillingTab>[] = [
    { value: 'Drafts', label: 'Drafts' },
    { value: 'Balance due', label: 'Balance due' },
  ];

  return (
    <Card padding="none" className="flex h-full flex-col">
      <div className="border-b border-outline-variant px-4 py-3">
        <h2 className="text-headline-sm text-on-surface">Billing</h2>
      </div>

      <div className="border-b border-outline-variant px-4 py-3">
        <Tabs<BillingTab>
          items={tabItems}
          value={tab}
          onChange={setTab}
          ariaLabel="Billing filter"
        />
      </div>

      <div className="flex-1">
        {tab === 'Drafts'
          ? draftsError
            ? (
              <div className="p-3">
                <ErrorBanner message={draftsError} onRetry={onDraftsRetry} />
              </div>
            )
            : draftsLoading && drafts.length === 0
              ? <RowsSkeleton />
              : drafts.length === 0
                ? <EmptyState icon="receipt_long" title="No draft invoices" />
                : (
                  <ul className="divide-y divide-outline-variant">
                    {drafts.map((invoice) => (
                      <li key={invoice.invoiceId}>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(invoice.invoiceId)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-body-sm font-medium text-on-surface">
                              {invoice.patientName ?? `Patient #${invoice.patientId ?? '—'}`}
                            </div>
                            <div className="text-label-md text-on-surface-variant">
                              #{invoice.invoiceId}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-body-sm font-medium text-on-surface">
                              {formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
                            </span>
                            <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot pill>
                              {invoice.status}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
          : balancesError
            ? (
              <div className="p-3">
                <ErrorBanner message={balancesError} onRetry={onBalancesRetry} />
              </div>
            )
            : balancesLoading && balances.length === 0
              ? <RowsSkeleton />
              : balances.length === 0
                ? <EmptyState icon="account_balance_wallet" title="No outstanding balances" />
                : (
                  <ul className="divide-y divide-outline-variant">
                    {balances.map((item) => (
                      <li key={item.invoiceId}>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(item.invoiceId)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-body-sm font-medium text-on-surface">
                              {item.patientName}
                            </div>
                            <div className="text-label-md text-on-surface-variant">
                              #{item.invoiceId}
                            </div>
                          </div>
                          <span className="shrink-0 text-body-sm font-semibold text-error">
                            {formatCurrency(item.outstandingAmount)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
      </div>

      <footer className="border-t border-outline-variant px-4 py-2">
        <button
          type="button"
          onClick={() => onViewAll(tab)}
          className="rounded-md px-1 text-label-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all
        </button>
      </footer>
    </Card>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton height={12} width="55%" />
            <Skeleton height={10} width="30%" />
          </div>
          <Skeleton height={14} width={72} />
        </div>
      ))}
    </div>
  );
}
