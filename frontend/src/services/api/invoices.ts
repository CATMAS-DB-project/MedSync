import { apiGet, apiPost } from './client';
import type { Invoice, InvoiceStatus, PagedResult, Payment } from '../../types';

export interface InvoiceListParams
  extends Record<string, string | number | boolean | undefined> {
  status?: InvoiceStatus;
  branchId?: number;
  patientId?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchInvoices(params?: InvoiceListParams): Promise<PagedResult<Invoice>> {
  return apiGet<PagedResult<Invoice>>('/invoices', params);
}

export async function fetchInvoiceById(invoiceId: number): Promise<Invoice> {
  return apiGet<Invoice>(`/invoices/${invoiceId}`);
}

export async function finalizeInvoice(
  invoiceId: number,
  input?: {
    insuranceDeduction?: number;
    manualDiscount?: number;
  },
): Promise<Invoice> {
  return apiPost<Invoice>(`/invoices/${invoiceId}/finalize`, input ?? {});
}

export async function fetchInvoicePayments(invoiceId: number): Promise<Payment[]> {
  return apiGet<Payment[]>(`/invoices/${invoiceId}/payments`);
}
