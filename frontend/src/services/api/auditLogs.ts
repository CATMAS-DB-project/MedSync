import { apiGet } from './client';


export interface AuditLog {
  logId: number;
  staffId?: number;
  actionType: string;
  tableAffected: string;
  recordId?: number;
  createdAt: string;
  details?: Record<string, unknown>;
}

export async function fetchAuditLogs(params?: Record<string, unknown>): Promise<AuditLog[]> {
  return apiGet<AuditLog[]>('/audit-logs', params);
}

export async function fetchAuditLogById(logId: number): Promise<AuditLog> {
  return apiGet<AuditLog>(`/audit-logs/${logId}`);
}
