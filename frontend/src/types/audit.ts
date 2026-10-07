export type AuditActionType = 'Create' | 'Update' | 'Delete';

export interface AuditLogEntry {
  logId: number;
  staffId: number;
  staffName?: string;
  actionType: AuditActionType;
  tableAffected: string;
  recordIdAffected: string;
  logTimestamp: string;
  details?: Record<string, unknown>;
}
