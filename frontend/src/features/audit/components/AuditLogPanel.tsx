import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SegmentedControl } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAuditLogs } from '../../../services/api/auditLogs';
import type { AuditLogListParams } from '../../../services/api/auditLogs';
import { daysAgoIso, todayIso } from '../../../utils/dates';
import { formatDate, formatTime } from '../../../utils/formatters';
import { AuditDetailModal } from './AuditDetailModal';
import type { AuditActionType, AuditLogEntry } from '../../../types';

const PAGE_SIZE = 10;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type RangeKey = 'today' | '7d' | '30d' | 'custom';

const RANGE_ITEMS: TabItem<RangeKey>[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

const TABLE_OPTIONS = [
  { label: 'All tables', value: 'all' },
  { label: 'patient', value: 'patient' },
  { label: 'appointment_treatment', value: 'appointment_treatment' },
  { label: 'invoice', value: 'invoice' },
];

const ACTION_OPTIONS = [
  { label: 'All actions', value: 'all' },
  { label: 'Create', value: 'Create' },
  { label: 'Update', value: 'Update' },
  { label: 'Delete', value: 'Delete' },
];

function parseDate(value: string | null, fallback: string): string {
  return value && ISO_DATE.test(value) ? value : fallback;
}

function detectRange(from: string, to: string): RangeKey {
  const today = todayIso();
  if (from === today && to === today) return 'today';
  if (from === daysAgoIso(6) && to === today) return '7d';
  if (from === daysAgoIso(29) && to === today) return '30d';
  return 'custom';
}

function rangeFor(key: RangeKey): { from: string; to: string } | null {
  const to = todayIso();
  switch (key) {
    case 'today': return { from: to, to };
    case '7d': return { from: daysAgoIso(6), to };
    case '30d': return { from: daysAgoIso(29), to };
    case 'custom': return null;
  }
}

function actionTone(action: string): 'success' | 'primary' | 'error' | 'neutral' {
  switch (action) {
    case 'Create': return 'success';
    case 'Update': return 'primary';
    case 'Delete': return 'error';
    default: return 'neutral';
  }
}

function timeHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AuditLogPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultFrom = daysAgoIso(6);
  const defaultTo = todayIso();
  const from = parseDate(searchParams.get('from'), defaultFrom);
  const to = parseDate(searchParams.get('to'), defaultTo);
  const actionType = searchParams.get('actionType') ?? 'all';
  const tableAffected = searchParams.get('table') ?? 'all';
  const recordId = searchParams.get('recordId') ?? '';
  const staffId = searchParams.get('staffId') ?? '';
  const rawPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const preset = detectRange(from, to);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const logs = useAsync(async () => {
    const params: AuditLogListParams = { page, pageSize: PAGE_SIZE };
    if (actionType !== 'all') params.actionType = actionType as AuditActionType;
    if (tableAffected !== 'all') params.tableAffected = tableAffected;
    if (recordId.trim()) params.recordId = recordId.trim();
    const staffNum = Number(staffId.trim());
    if (staffId.trim() && Number.isFinite(staffNum) && staffNum > 0) {
      params.staffId = staffNum;
    }
    params.from = `${from}T00:00:00Z`;
    params.to = `${to}T23:59:59Z`;
    return fetchAuditLogs(params);
  }, [from, to, actionType, tableAffected, recordId, staffId, page]);

  const rows = logs.data?.items ?? [];
  const total = logs.data?.total ?? 0;
  const isFirstLoad = logs.isLoading && logs.data === undefined;

  const [openLogId, setOpenLogId] = useState<number | null>(null);

  const hasFilters =
    from !== defaultFrom ||
    to !== defaultTo ||
    actionType !== 'all' ||
    tableAffected !== 'all' ||
    recordId.trim() !== '' ||
    staffId.trim() !== '';

  const handleReset = () => {
    updateParams({
      from: null,
      to: null,
      actionType: null,
      table: null,
      recordId: null,
      staffId: null,
      page: null,
    });
  };

  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: 'time',
      header: 'Time',
      primary: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span>{formatDate(row.logTimestamp)}</span>
          <span className="text-label-md text-on-surface-variant">
            {formatTime(timeHHMM(row.logTimestamp))}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      secondary: true,
      cell: (row) =>
        row.staffName ?? (row.staffId != null ? `Staff #${row.staffId}` : '—'),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (row) => (
        <Badge tone={actionTone(row.actionType)} dot pill>
          {row.actionType}
        </Badge>
      ),
    },
    {
      key: 'table',
      header: 'Table',
      hideOnMobile: true,
      cell: (row) => (
        <span className="font-mono text-on-surface-variant">{row.tableAffected}</span>
      ),
    },
    {
      key: 'record',
      header: 'Record',
      hideOnMobile: true,
      cell: (row) => <span className="font-mono">{row.recordIdAffected || '—'}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-card">
        <div className="flex flex-col gap-3">
          <SegmentedControl<RangeKey>
            ariaLabel="Date range"
            items={RANGE_ITEMS}
            value={preset}
            onChange={(next) => {
              const r = rangeFor(next);
              if (r) updateParams({ from: r.from, to: r.to, page: null });
            }}
          />

          {preset === 'custom' && (
            <div className="flex flex-wrap gap-3">
              <div className="w-44">
                <Input
                  label="From"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const nextTo = e.target.value > to ? e.target.value : to;
                    updateParams({ from: e.target.value, to: nextTo, page: null });
                  }}
                />
              </div>
              <div className="w-44">
                <Input
                  label="To"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const nextFrom = e.target.value < from ? e.target.value : from;
                    updateParams({ from: nextFrom, to: e.target.value, page: null });
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Action"
              value={actionType}
              onChange={(e) =>
                updateParams({
                  actionType: e.target.value === 'all' ? null : e.target.value,
                  page: null,
                })
              }
              options={ACTION_OPTIONS}
            />
            <Select
              label="Table"
              value={tableAffected}
              onChange={(e) =>
                updateParams({
                  table: e.target.value === 'all' ? null : e.target.value,
                  page: null,
                })
              }
              options={TABLE_OPTIONS}
            />
            <Input
              label="Record id"
              value={recordId}
              onChange={(e) =>
                updateParams({ recordId: e.target.value || null, page: null })
              }
              placeholder="e.g. 42"
            />
            <Input
              label="Staff id"
              value={staffId}
              onChange={(e) =>
                updateParams({ staffId: e.target.value || null, page: null })
              }
              placeholder="e.g. 5"
            />
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" icon="restart_alt" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => String(row.logId)}
        onRowClick={(row) => setOpenLogId(row.logId)}
        loading={isFirstLoad}
        error={logs.error}
        onRetry={logs.reload}
        skeletonRows={PAGE_SIZE}
        emptyState={
          hasFilters ? (
            <EmptyState
              icon="history"
              title="No audit entries"
              action={
                <Button variant="secondary" size="sm" onClick={handleReset}>
                  Reset filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon="history" title="No audit entries" />
          )
        }
        pagination={
          total > 0 ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={total}
              onPageChange={(p) => updateParams({ page: String(p) })}
            />
          ) : undefined
        }
      />

      <AuditDetailModal logId={openLogId} onClose={() => setOpenLogId(null)} />
    </div>
  );
}
