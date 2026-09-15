import type { BadgeTone } from '../../components/ui/Badge';
import type { PatientStatus } from '../../types';

export const PATIENT_STATUS_TONE: Record<PatientStatus, BadgeTone> = {
  Active: 'success',
  Inactive: 'neutral',
  Pending: 'warning',
};
