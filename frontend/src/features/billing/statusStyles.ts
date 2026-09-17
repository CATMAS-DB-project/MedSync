import type { BadgeTone } from '../../components/ui/Badge';
import type { InvoiceStatus } from '../../types';

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  Paid: 'success',
  Pending: 'primary',
  Overdue: 'error',
  'Partially Paid': 'warning',
  Cancelled: 'neutral',
};
