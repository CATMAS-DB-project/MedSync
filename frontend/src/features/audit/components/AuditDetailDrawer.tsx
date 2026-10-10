import { useAsync } from '../../../hooks/useAsync';
import { fetchAuditLogById } from '../../../services/api/auditLogs';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { formatDate } from '../../../utils/formatters';

interface AuditDetailDrawerProps {
  logId: number | null;
  onClose: () => void;
}

export function AuditDetailDrawer({ logId, onClose }: AuditDetailDrawerProps) {
  const logDetails = useAsync(
    () => (logId !== null ? fetchAuditLogById(logId) : Promise.resolve(null)),
    [logId],
  );

  if (logId === null) return null;

  const entry = logDetails.data;

  // Format details safely without any HTML injection
  const renderDetails = () => {
    if (!entry?.details) {
      return (
        <p className="text-body-sm text-on-surface-variant italic">
          No payload details recorded for this entry.
        </p>
      );
    }

    let textContent = '';
    if (typeof entry.details === 'object') {
      try {
        textContent = JSON.stringify(entry.details, null, 2);
      } catch {
        textContent = String(entry.details);
      }
    } else {
      textContent = String(entry.details);
    }

    return (
      <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-outline-variant bg-surface-container-low p-4 font-mono text-xs leading-6 text-on-surface whitespace-pre-wrap break-words">
        {textContent}
      </pre>
    );
  };

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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant bg-gradient-to-r from-primary-container/60 via-surface-container-low to-tertiary-container/40 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-xl bg-surface-container-lowest p-2.5 text-primary shadow-sm ring-1 ring-outline-variant">
              <Icon name="history" size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-headline-sm font-semibold text-on-surface">
                Audit Mutation #{logId}
              </h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Database audit details
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} icon="close" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {logDetails.error && (
            <ErrorBanner message={logDetails.error} onRetry={logDetails.reload} />
          )}

          {logDetails.isLoading && !entry ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-8 text-center text-body-sm text-on-surface-variant">
              <Icon name="progress_activity" size={24} />
              <p className="mt-3">Loading mutation details…</p>
            </div>
          ) : entry ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="text-label-md block text-on-surface-variant">Action Type</span>
                  <div className="mt-2">
                    <Badge tone={getActionTone(entry.actionType)}>
                      {entry.actionType}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="text-label-md block text-on-surface-variant">Table Affected</span>
                  <span className="mt-2 block break-words font-mono text-body-md font-semibold text-on-surface">
                    {entry.tableAffected}
                  </span>
                </div>

                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="text-label-md block text-on-surface-variant">Record ID Affected</span>
                  <span className="mt-2 block font-mono text-body-md text-on-surface">
                    {String(entry.recordId ?? '—')}
                  </span>
                </div>

                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <span className="text-label-md block text-on-surface-variant">Staff ID</span>
                  <span className="mt-2 block text-body-md text-on-surface">
                    {entry.staffId !== undefined ? `#${entry.staffId}` : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-body-sm">
                <span className="text-label-md block text-on-surface-variant">Timestamp</span>
                <span className="mt-2 block text-body-md text-on-surface">
                  {entry.createdAt ? formatDate(entry.createdAt) : '—'}
                </span>
                {entry.createdAt && (
                  <span className="mt-1 block break-all font-mono text-xs text-on-surface-variant">
                    {entry.createdAt}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <div className="flex items-center gap-2">
                  <Icon name="difference" size={18} />
                  <h4 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
                    Mutation Payload Diff
                  </h4>
                </div>
                {renderDetails()}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-outline-variant bg-surface-container-low p-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
