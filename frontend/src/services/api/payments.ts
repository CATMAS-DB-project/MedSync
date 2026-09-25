import { apiGet, apiPost } from './client';
import type { Payment } from '../../types';

export async function recordPayment(
  invoiceId: number,
  input: {
    amountPaid: number;
    paymentMethod: 'Cash' | 'Credit Card' | 'Insurance';
  },
): Promise<Payment> {
  return apiPost<Payment>(`/invoices/${invoiceId}/payments`, input);
}

export async function fetchPaymentById(paymentId: number): Promise<Payment> {
  return apiGet<Payment>(`/payments/${paymentId}`);
}
