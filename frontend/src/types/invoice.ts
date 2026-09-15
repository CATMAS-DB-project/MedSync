export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid' | 'Cancelled';

export type PaymentMethod = 'Cash' | 'Card' | 'Insurance' | 'Bank Transfer';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  branch: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
}
