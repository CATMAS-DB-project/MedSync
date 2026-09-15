import type { BadgeTone } from '../../components/ui/Badge';
import type { StaffStatus } from '../../types';

export const STAFF_STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  Active: 'success',
  'On Leave': 'warning',
  Inactive: 'neutral',
};
