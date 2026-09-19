import type { Invoice, Payment } from '../types';

/** Matches: subtotal_amount - insurance_deduction - manual_discount. */
export function calculatePayableAmount(invoice: Invoice): number {
  return invoice.subtotalAmount - invoice.insuranceDeduction - invoice.manualDiscount;
}

/** Matches the outstanding-balance query: payable - SUM(payment.amount_paid). */
export function calculateOutstandingBalance(invoice: Invoice, payments: Payment[]): number {
  const totalPaid = payments
    .filter((payment) => payment.invoiceId === invoice.invoiceId)
    .reduce((sum, payment) => sum + payment.amountPaid, 0);
  return calculatePayableAmount(invoice) - totalPaid;
}

export function calculateAmountPaid(invoiceId: number, payments: Payment[]): number {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amountPaid, 0);
}
