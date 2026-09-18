import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import type { Invoice } from '../../../types';

export interface InvoiceDetailDrawerProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export function InvoiceDetailDrawer({ invoice, onClose }: InvoiceDetailDrawerProps) {
  const balance = invoice ? invoice.total - invoice.amountPaid : 0;

  return (
    <Drawer
      isOpen={invoice !== null}
      onClose={onClose}
      title={invoice?.invoiceNumber ?? ''}
      subtitle={invoice?.patientName}
    >
      {invoice && (
        <>
          <DrawerSection title="Summary" icon="receipt_long">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <div className="text-on-surface-variant text-label-md">Issue Date</div>
                <div className="text-on-surface">{formatDate(invoice.issueDate)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Due Date</div>
                <div className="text-on-surface">{formatDate(invoice.dueDate)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Branch</div>
                <div className="text-on-surface">{invoice.branch}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Status</div>
                <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Line Items" icon="list_alt">
            <table className="w-full text-left border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant text-label-md text-on-surface-variant">
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5 text-center">Qty</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-outline-variant/60">
                    <td className="py-1.5 text-on-surface">{item.description}</td>
                    <td className="py-1.5 text-center text-on-surface-variant">{item.quantity}</td>
                    <td className="py-1.5 text-right text-on-surface">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DrawerSection>

          <DrawerSection title="Payment" icon="payments">
            <div className="flex flex-col gap-2 text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="text-on-surface">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Tax</span>
                <span className="text-on-surface">{formatCurrency(invoice.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-outline-variant pt-2">
                <span className="text-on-surface">Total</span>
                <span className="text-on-surface">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Amount Paid</span>
                <span className="text-on-surface">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-on-surface">Balance Due</span>
                <span className={balance > 0 ? 'text-error' : 'text-success'}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}
