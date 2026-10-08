import { apiGet, apiPost } from './client';
import type {
  Invoice,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceStatus,
  PagedResult,
  Payment,
} from '../../types';

export interface InvoiceListParams
  extends Record<string, string | number | boolean | undefined> {
  status?: InvoiceStatus;
  branchId?: number;
  patientId?: number;
  page?: number;
  pageSize?: number;
}

// Money columns can arrive as strings (Postgres numeric); make them numbers.
function toInvoice<T extends Invoice>(raw: T): T {
  return {
    ...raw,
    subtotalAmount: Number(raw.subtotalAmount),
    insuranceDeduction: Number(raw.insuranceDeduction),
    manualDiscount: Number(raw.manualDiscount),
    payableAmount: raw.payableAmount === undefined ? undefined : Number(raw.payableAmount),
    amountPaid: raw.amountPaid === undefined ? undefined : Number(raw.amountPaid),
    outstandingAmount: raw.outstandingAmount === undefined ? undefined : Number(raw.outstandingAmount),
  };
}

function toPayment(raw: Payment): Payment {
  return { ...raw, amountPaid: Number(raw.amountPaid) };
}

export async function fetchInvoices(params?: InvoiceListParams): Promise<PagedResult<Invoice>> {
  const result = await apiGet<PagedResult<Invoice>>('/invoices', params);
  return { ...result, items: result.items.map(toInvoice) };
}

export async function fetchInvoiceById(invoiceId: number): Promise<InvoiceDetail> {
  const raw = await apiGet<InvoiceDetail>(`/invoices/${invoiceId}`);
  const lineItems: InvoiceLineItem[] = (raw.lineItems ?? []).map((item) => ({
    ...item,
    priceAtTime: Number(item.priceAtTime),
  }));
  return { ...toInvoice(raw), lineItems };
}

export async function finalizeInvoice(
  invoiceId: number,
  input?: {
    insuranceDeduction?: number;
    manualDiscount?: number;
  },
): Promise<Invoice> {
  const raw = await apiPost<Invoice>(`/invoices/${invoiceId}/finalize`, input ?? {});
  return toInvoice(raw);
}

/** The backend returns a paged list here, not a bare array. */
export async function fetchInvoicePayments(invoiceId: number): Promise<Payment[]> {
  const result = await apiGet<PagedResult<Payment>>(`/invoices/${invoiceId}/payments`, {
    pageSize: 100,
  });
  return result.items.map(toPayment);
}
