import { apiGet } from './client';
import type { AuditActionType, AuditLogEntry, PagedResult } from '../../types';

export type AuditLog = AuditLogEntry;

export interface AuditLogListParams extends Record<string, unknown> {
  staffId?: number;
  actionType?: AuditActionType | string;
  tableAffected?: string;
  from?: string;
  to?: string;
  recordId?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchAuditLogs(
  params?: AuditLogListParams,
): Promise<PagedResult<AuditLogEntry>> {
  return apiGet<PagedResult<AuditLogEntry>>('/audit-logs', params);
}

export async function fetchAuditLogById(logId: number): Promise<AuditLogEntry> {
  return apiGet<AuditLogEntry>(`/audit-logs/${logId}`);
}

