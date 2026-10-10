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
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
      <div className="flex flex-col gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="text-headline-sm text-on-surface">Database Audit Trail</h3>
          <p className="text-body-sm text-on-surface-variant">
            Live mutation logs captured by database triggers across clinical and financial records
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-3 py-1.5 text-label-md font-medium text-on-secondary-fixed">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">history</span>
          Total records: <span className="font-bold">{total.toLocaleString()}</span>
        </div>
      </div>

      <div className="border-b border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">filter_alt</span>
          </span>
          <div>
            <h4 className="text-body-md font-semibold text-on-surface">Filter audit logs</h4>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">Narrow results by table, action, staff member, or date.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Table affected"
            options={TABLE_OPTIONS}
            value={tableAffected}
            onChange={(e) => {
              setTableAffected(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Action type"
            options={ACTION_OPTIONS}
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Staff ID"
            placeholder="e.g. 1"
            value={staffIdInput}
            onChange={(e) => {
              setStaffIdInput(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="From date"
            type="date"
            value={fromTime}
            onChange={(e) => {
              setFromTime(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To date"
            type="date"
            value={toTime}
            onChange={(e) => {
              setToTime(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

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
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant bg-primary-fixed/20">
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Log ID</th>
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Timestamp</th>
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Action</th>
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Table</th>
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Record ID</th>
                <th scope="col" className="p-table-cell-padding text-label-md font-semibold text-on-surface-variant">Staff ID</th>
                <th scope="col" className="p-table-cell-padding text-right text-label-md font-semibold text-on-surface-variant">Details</th>
              </tr>
            </thead>
            <tbody className="text-table-data">
              {items.map((log) => (
                <tr
                  key={log.logId}
                  className="border-b border-outline-variant odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25"
                >
                  <td className="p-table-cell-padding font-mono text-body-sm font-medium text-primary">
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
