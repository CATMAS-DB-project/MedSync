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
      <pre className="mt-2 p-3 rounded-lg bg-surface-container-high font-mono text-xs text-on-surface whitespace-pre-wrap break-words border border-outline-variant overflow-x-auto">
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
        className="w-full max-w-lg bg-surface h-full shadow-2xl flex flex-col border-l border-outline-variant overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-surface-container-high text-on-surface">
              <Icon name="history" size={20} />
            </span>
            <div>
              <h3 className="text-headline-sm text-on-surface">Audit Mutation #{logId}</h3>
              <p className="text-label-md text-on-surface-variant">Database audit details</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} icon="close" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {logDetails.error && (
            <ErrorBanner message={logDetails.error} onRetry={logDetails.reload} />
          )}

          {logDetails.isLoading && !entry ? (
            <div className="py-12 text-center text-body-sm text-on-surface-variant animate-pulse">
              Loading mutation details…
            </div>
          ) : entry ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-body-sm">
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <span className="text-label-md text-on-surface-variant block">Action Type</span>
                  <div className="mt-1">
                    <Badge tone={getActionTone(entry.actionType)}>
                      {entry.actionType}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <span className="text-label-md text-on-surface-variant block">Table Affected</span>
                  <span className="font-mono text-body-md font-semibold text-on-surface mt-1 block">
                    {entry.tableAffected}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <span className="text-label-md text-on-surface-variant block">Record ID Affected</span>
                  <span className="font-mono text-body-md text-on-surface mt-1 block">
                    {String(entry.recordId ?? '—')}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                  <span className="text-label-md text-on-surface-variant block">Staff ID</span>
                  <span className="text-body-md text-on-surface mt-1 block">
                    {entry.staffId !== undefined ? `#${entry.staffId}` : '—'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-sm">
                <span className="text-label-md text-on-surface-variant block">Timestamp</span>
                <span className="text-body-md text-on-surface mt-1 block">
                  {entry.createdAt ? formatDate(entry.createdAt) : '—'} ({entry.createdAt})
                </span>
              </div>

              <div>
                <h4 className="text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                  Mutation Payload Diff (details)
                </h4>
                {renderDetails()}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
