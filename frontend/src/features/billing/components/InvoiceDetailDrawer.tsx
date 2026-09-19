import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { calculateAmountPaid, calculateOutstandingBalance, calculatePayableAmount } from '../../../utils/billing';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import { mockAppointmentTreatments } from '../../../services/mock/appointmentTreatments';
import { mockPayments } from '../../../services/mock/payments';
import type { Invoice } from '../../../types';

export interface InvoiceDetailDrawerProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export function InvoiceDetailDrawer({ invoice, onClose }: InvoiceDetailDrawerProps) {
  const lineItems = invoice
    ? mockAppointmentTreatments.filter((treatment) => treatment.appointmentId === invoice.appointmentId)
    : [];
  const invoicePayments = invoice
    ? mockPayments.filter((payment) => payment.invoiceId === invoice.invoiceId)
    : [];
  const payableAmount = invoice ? calculatePayableAmount(invoice) : 0;
  const amountPaid = invoice ? calculateAmountPaid(invoice.invoiceId, mockPayments) : 0;
  const balance = invoice ? calculateOutstandingBalance(invoice, mockPayments) : 0;

  return (
    <Drawer
      isOpen={invoice !== null}
      onClose={onClose}
      title={invoice ? `Invoice #${invoice.invoiceId}` : ''}
      subtitle={invoice?.patientName}
    >
      {invoice && (
        <>
          <DrawerSection title="Summary" icon="receipt_long">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <div className="text-on-surface-variant text-label-md">Created</div>
                <div className="text-on-surface">{formatDate(invoice.createdAt)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Branch</div>
                <div className="text-on-surface">{invoice.branchName}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Status</div>
                <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Logged Treatments" icon="list_alt">
            <table className="w-full text-left border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant text-label-md text-on-surface-variant">
                  <th className="py-1.5">Service</th>
                  <th className="py-1.5 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.appointmentTreatmentId} className="border-b border-outline-variant/60">
                    <td className="py-1.5 text-on-surface">
                      {item.treatmentName ?? item.serviceCode}
                      {item.isAmended && (
                        <span className="ml-1.5 text-label-md text-tertiary">(amended)</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-on-surface">
                      {formatCurrency(item.priceAtTime)}
                    </td>
                  </tr>
                ))}
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-3 text-center text-on-surface-variant">
                      No treatments logged for this visit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DrawerSection>

          <DrawerSection title="Payment" icon="payments">
            <div className="flex flex-col gap-2 text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="text-on-surface">{formatCurrency(invoice.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Insurance Deduction</span>
                <span className="text-on-surface">-{formatCurrency(invoice.insuranceDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Manual Discount</span>
                <span className="text-on-surface">-{formatCurrency(invoice.manualDiscount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-outline-variant pt-2">
                <span className="text-on-surface">Payable Amount</span>
                <span className="text-on-surface">{formatCurrency(payableAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Amount Paid</span>
                <span className="text-on-surface">{formatCurrency(amountPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-on-surface">Balance Due</span>
                <span className={balance > 0 ? 'text-error' : 'text-success'}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>
          </DrawerSection>

          {invoicePayments.length > 0 && (
            <DrawerSection title="Payment History" icon="history">
              <div className="flex flex-col gap-2 text-body-sm">
                {invoicePayments.map((payment) => (
                  <div key={payment.paymentId} className="flex justify-between">
                    <span className="text-on-surface-variant">
                      {formatDate(payment.paymentDate)} · {payment.paymentMethod}
                    </span>
                    <span className="text-on-surface">{formatCurrency(payment.amountPaid)}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}
