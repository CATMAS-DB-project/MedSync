import { useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAuditLogById } from '../../../services/api/auditLogs';
import { formatDate, formatTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import type { AuditActionType, AuditLogEntry } from '../../../types';

export interface AuditDetailModalProps {
  logId: number | null;
  onClose: () => void;
}

function actionTone(action: AuditActionType | string): 'success' | 'primary' | 'error' | 'neutral' {
  switch (action) {
    case 'Create': return 'success';
    case 'Update': return 'primary';
    case 'Delete': return 'error';
    default: return 'neutral';
  }
}

function timestampLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)} · ${formatTime(`${hh}:${mm}`)}`;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface DiffShape {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

function extractDiff(details: Record<string, unknown> | undefined): DiffShape | null {
  if (!details) return null;
  const beforeKey = ['oldValues', 'before', 'old'].find(
    (k) => details[k] && typeof details[k] === 'object',
  );
  const afterKey = ['newValues', 'after', 'new'].find(
    (k) => details[k] && typeof details[k] === 'object',
  );
  if (beforeKey && afterKey) {
    return {
      before: details[beforeKey] as Record<string, unknown>,
      after: details[afterKey] as Record<string, unknown>,
    };
  }
  return null;
}

export function AuditDetailModal({ logId, onClose }: AuditDetailModalProps) {
  const toast = useToast();
  const entry = useAsync<AuditLogEntry | null>(
    () => (logId === null ? Promise.resolve(null) : fetchAuditLogById(logId)),
    [logId],
  );
  const [copied, setCopied] = useState(false);

  const log = entry.data;

  const diff = useMemo(
    () => (log?.details ? extractDiff(log.details) : null),
    [log?.details],
  );

  const handleCopy = async () => {
    if (!log?.details) return;
    try {
      await navigator.clipboard.writeText(prettyJson(log.details));
      setCopied(true);
      toast.success('Copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <Modal
      isOpen={logId !== null}
      onClose={onClose}
      size="lg"
      title={logId !== null ? `Audit #${logId}` : 'Audit entry'}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {entry.isLoading && !log && (
        <div className="flex flex-col gap-3">
          <Skeleton height={24} width="40%" />
          <Skeleton height={140} rounded="xl" />
        </div>
      )}

      {entry.error && <ErrorBanner message={entry.error} onRetry={entry.reload} />}

      {log && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={actionTone(log.actionType)} dot pill>
              {log.actionType}
            </Badge>
            <span className="text-label-md text-on-surface-variant">
              {timestampLabel(log.logTimestamp)}
            </span>
          </div>

          <dl className="flex flex-col gap-1.5 rounded-2xl bg-surface-container-low p-4">
            <Row label="User" value={log.staffName ?? (log.staffId != null ? `Staff #${log.staffId}` : '—')} />
            <Row label="Table" value={log.tableAffected} mono />
            <Row label="Record" value={log.recordIdAffected || '—'} mono />
          </dl>

          <section className="flex flex-col gap-2">
            <header className="flex items-center justify-between gap-2">
              <h4 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {diff ? 'Before · After' : 'Payload'}
              </h4>
              {!diff && log.details && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copied ? 'check' : 'content_copy'}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </header>

            {!log.details ? (
              <p className="rounded-2xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                No payload details recorded for this entry.
              </p>
            ) : diff ? (
              <div className="overflow-hidden rounded-2xl bg-surface-container-low">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="px-3 py-2 text-left text-label-sm uppercase tracking-wider text-on-surface-variant">
                        Field
                      </th>
                      <th className="px-3 py-2 text-left text-label-sm uppercase tracking-wider text-on-surface-variant">
                        Before
                      </th>
                      <th className="px-3 py-2 text-left text-label-sm uppercase tracking-wider text-on-surface-variant">
                        After
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      new Set([...Object.keys(diff.before), ...Object.keys(diff.after)]),
                    ).map((key) => {
                      const before = diff.before[key];
                      const after = diff.after[key];
                      const changed =
                        JSON.stringify(before) !== JSON.stringify(after);
                      return (
                        <tr
                          key={key}
                          className={cn(
                            'border-b border-outline-variant/60 last:border-b-0 align-top',
                            changed ? 'bg-warning-container/40' : 'opacity-70',
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-label-md text-on-surface">
                            {key}
                          </td>
                          <td className="px-3 py-2 font-mono text-label-md text-on-surface">
                            <ValueCell value={before} />
                          </td>
                          <td className="px-3 py-2 font-mono text-label-md text-on-surface">
                            <ValueCell value={after} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="max-h-[360px] overflow-auto rounded-2xl bg-surface-container-low p-4 font-mono text-label-md whitespace-pre-wrap break-words text-on-surface">
                {prettyJson(log.details)}
              </pre>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-label-md text-on-surface-variant">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-body-sm text-on-surface',
          mono && 'font-mono',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ValueCell({ value }: { value: unknown }) {
  if (value === undefined) return <span className="text-on-surface-variant">—</span>;
  if (value === null) return <span className="text-on-surface-variant">null</span>;
  if (typeof value === 'object') {
    return (
      <span className="block max-h-40 overflow-auto whitespace-pre-wrap break-words">
        {prettyJson(value)}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}
