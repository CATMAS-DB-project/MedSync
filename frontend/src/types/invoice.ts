export type InvoiceStatus = 'Draft' | 'Finalized' | 'Paid' | 'Partially Paid';

export interface Invoice {
  invoiceId: number;
  appointmentId: number;
  patientId?: number;
  patientName?: string;
  branchId?: number;
  branchName?: string;
  subtotalAmount: number;
  insuranceDeduction: number;
  manualDiscount: number;
  status: InvoiceStatus;
  createdAt?: string;
  finalizedByStaffId?: number;
  // Computed by the backend view v_invoice_outstanding (not stored columns).
  payableAmount?: number;
  amountPaid?: number;
  outstandingAmount?: number;
}

export interface InvoiceLineItem {
  appointmentTreatmentId: number;
  serviceCode: string;
  treatmentName: string;
  priceAtTime: number;
  isAmended: boolean;
  originalRecordId?: number | null;
}

export interface InvoiceDetail extends Invoice {
  appointmentDate?: string;
  lineItems: InvoiceLineItem[];
}

export type PaymentMethod = 'Cash' | 'Credit Card' | 'Insurance';

export interface Payment {
  paymentId: number;
  invoiceId: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  processedByStaffId: number;
}

export type ClaimVerificationStatus = 'Pending' | 'Approved' | 'Rejected';

export interface InsuranceClaim {
  claimId: number;
  invoiceId: number;
  policyId: string;
  claimedAmount: number;
  approvedAmount?: number | null;
  verificationStatus: ClaimVerificationStatus;
  verificationDate?: string | null;
}
