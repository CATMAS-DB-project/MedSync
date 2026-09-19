import type { BadgeTone } from '../../components/ui/Badge';
import type { EmploymentStatus } from '../../types';

export const EMPLOYMENT_STATUS_TONE: Record<EmploymentStatus, BadgeTone> = {
  Active: 'success',
  OnLeave: 'warning',
  Terminated: 'neutral',
};
