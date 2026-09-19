import type { BadgeTone } from '../../components/ui/Badge';
import type { InvoiceStatus } from '../../types';

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  Paid: 'success',
  Finalized: 'primary',
  Draft: 'neutral',
  'Partially Paid': 'warning',
};
