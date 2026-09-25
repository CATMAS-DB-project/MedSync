export type InvoiceStatus = 'Draft' | 'Finalized' | 'Paid' | 'Partially Paid';

export interface Invoice {
  invoiceId: number;
  appointmentId: number;
  patientId?: number;
  patientName?: string;
  branchName?: string;
  subtotalAmount: number;
  insuranceDeduction: number;
  manualDiscount: number;
  status: InvoiceStatus;
  createdAt: string;
  finalizedByStaffId?: number;
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
  approvedAmount?: number;
  verificationStatus: ClaimVerificationStatus;
  verificationDate?: string;
}
