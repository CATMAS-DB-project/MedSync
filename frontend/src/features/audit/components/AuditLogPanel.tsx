import { useState } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAuditLogs, type AuditLog } from '../../../services/api/auditLogs';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/common/Pagination';
import { TableSkeleton } from '../../../components/common/TableSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatDate } from '../../../utils/formatters';
import { AuditDetailDrawer } from './AuditDetailDrawer';

// Exact audited tables attached to fn_audit_log() triggers in database migration
const TABLE_OPTIONS = [
  { label: 'All Tables', value: 'all' },
  { label: 'patient', value: 'patient' },
  { label: 'appointment_treatment', value: 'appointment_treatment' },
  { label: 'invoice', value: 'invoice' },
];

// Exact audit_action_enum values defined in database schema
const ACTION_OPTIONS = [
  { label: 'All Actions', value: 'all' },
  { label: 'Create', value: 'Create' },
  { label: 'Update', value: 'Update' },
  { label: 'Delete', value: 'Delete' },
];

const PAGE_SIZE = 10;

export function AuditLogPanel() {
  const [tableAffected, setTableAffected] = useState<string>('all');
  const [actionType, setActionType] = useState<string>('all');
  const [staffIdInput, setStaffIdInput] = useState<string>('');
  const [fromTime, setFromTime] = useState<string>('');
  const [toTime, setToTime] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [inspectLogId, setInspectLogId] = useState<number | null>(null);

  const logsAsync = useAsync(async () => {
    const params: Record<string, unknown> = {
      page,
      pageSize: PAGE_SIZE,
    };

    if (tableAffected !== 'all') {
      params.tableAffected = tableAffected;
    }
    if (actionType !== 'all') {
      params.actionType = actionType;
    }
    if (staffIdInput.trim()) {
      const parsedStaffId = Number(staffIdInput.trim());
      if (!Number.isNaN(parsedStaffId) && parsedStaffId > 0) {
        params.staffId = parsedStaffId;
      }
    }
    if (fromTime) {
      params.from = `${fromTime}T00:00:00Z`;
    }
    if (toTime) {
      params.to = `${toTime}T23:59:59Z`;
    }

    const res = await fetchAuditLogs(params);
    // Handle both direct array and paged response envelope
    if (Array.isArray(res)) {
      return { items: res, total: res.length };
    }
    const paged = res as unknown as { items?: AuditLog[]; total?: number };
    return {
      items: paged.items ?? [],
      total: paged.total ?? 0,
    };
  }, [tableAffected, actionType, staffIdInput, fromTime, toTime, page]);

  const items = logsAsync.data?.items ?? [];
  const total = logsAsync.data?.total ?? 0;

  const getActionTone = (action?: string): 'success' | 'secondary' | 'error' | 'neutral' => {
    switch (action?.toLowerCase()) {
      case 'create':
        return 'success';
      case 'update':
        return 'secondary';
      case 'delete':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-headline-sm text-on-surface">Database Audit Trail</h3>
          <p className="text-body-sm text-on-surface-variant">
            Live mutation logs captured by database triggers across clinical and financial records
          </p>
        </div>
        <div className="text-label-md text-on-surface-variant">
          Total records: <span className="font-semibold text-on-surface">{total}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 border-b border-outline-variant bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-label-md text-on-surface-variant mb-1">Table Affected</label>
          <Select
            options={TABLE_OPTIONS}
            value={tableAffected}
            onChange={(e) => {
              setTableAffected(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-1">Action Type</label>
          <Select
            options={ACTION_OPTIONS}
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-1">Staff ID</label>
          <Input
            placeholder="e.g. 1"
            value={staffIdInput}
            onChange={(e) => {
              setStaffIdInput(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-1">From Date</label>
          <input
            type="date"
            value={fromTime}
            onChange={(e) => {
              setFromTime(e.target.value);
              setPage(1);
            }}
            className="w-full rounded border border-outline-variant bg-surface px-3 py-1.5 text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-1">To Date</label>
          <input
            type="date"
            value={toTime}
            onChange={(e) => {
              setToTime(e.target.value);
              setPage(1);
            }}
            className="w-full rounded border border-outline-variant bg-surface px-3 py-1.5 text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table Content */}
      {logsAsync.error ? (
        <div className="p-4">
          <ErrorBanner message={logsAsync.error} onRetry={logsAsync.reload} />
        </div>
      ) : logsAsync.isLoading && items.length === 0 ? (
        <div className="p-4">
          <TableSkeleton rows={5} columns={7} />
        </div>
      ) : items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No audit logs found"
            description="No database mutations match the selected filters."
            icon="history"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-bright">
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Log ID</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Timestamp</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Action</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Table</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Record ID</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium">Staff ID</th>
                <th className="p-table-cell-padding text-label-md text-on-surface-variant font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {items.map((log) => (
                <tr
                  key={log.logId}
                  className="border-b border-outline-variant hover:bg-surface-container-high transition-colors"
                >
                  <td className="p-table-cell-padding font-mono text-body-sm text-on-surface-variant">
                    #{log.logId}
                  </td>
                  <td className="p-table-cell-padding text-body-sm text-on-surface-variant whitespace-nowrap">
                    {formatDate(log.createdAt || (log as unknown as { logTimestamp?: string }).logTimestamp)}
                  </td>
                  <td className="p-table-cell-padding">
                    <Badge tone={getActionTone(log.actionType)}>
                      {log.actionType}
                    </Badge>
                  </td>
                  <td className="p-table-cell-padding font-mono text-body-sm font-medium text-on-surface">
                    {log.tableAffected}
                  </td>
                  <td className="p-table-cell-padding font-mono text-body-sm text-on-surface-variant">
                    {String(log.recordId ?? (log as unknown as { recordIdAffected?: string }).recordIdAffected ?? '—')}
                  </td>
                  <td className="p-table-cell-padding text-body-sm text-on-surface-variant">
                    {log.staffId ? `#${log.staffId}` : '—'}
                  </td>
                  <td className="p-table-cell-padding text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="visibility"
                      onClick={() => setInspectLogId(log.logId)}
                    >
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={total}
          onPageChange={setPage}
        />
      )}

      {/* Detail Drawer */}
      <AuditDetailDrawer
        logId={inspectLogId}
        onClose={() => setInspectLogId(null)}
      />
    </div>
  );
}
