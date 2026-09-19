import type { Payment } from '../../types';

export const mockPayments: Payment[] = [
  {
    paymentId: 1,
    invoiceId: 1,
    amountPaid: 210,
    paymentMethod: 'Credit Card',
    paymentDate: '2026-09-17T11:05:00Z',
    processedByStaffId: 6,
  },
  {
    paymentId: 2,
    invoiceId: 4,
    amountPaid: 60,
    paymentMethod: 'Cash',
    paymentDate: '2026-09-13T10:40:00Z',
    processedByStaffId: 6,
  },
];
