import type { BadgeTone } from '../../components/ui/Badge';
import type { AppointmentStatus } from '../../types';

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  Scheduled: 'primary',
  Completed: 'success',
  Cancelled: 'error',
};
