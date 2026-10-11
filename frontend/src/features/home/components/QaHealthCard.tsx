import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import type { SystemHealthState } from '../useSystemHealth';

export interface QaHealthCardProps {
  state: SystemHealthState;
  isChecking: boolean;
  onPing: () => void;
}

function timeLabel(d: Date | null): string {
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function QaHealthCard({ state, isChecking, onPing }: QaHealthCardProps) {
  const tone =
    state.status === 'ok' ? 'success' : state.status === 'down' ? 'error' : 'neutral';
  const label =
    state.status === 'ok' ? 'Online' : state.status === 'down' ? 'Down' : 'Checking…';

  return (
    <Card padding="lg">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-headline-sm text-on-surface">System health</h3>
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          onClick={onPing}
          isLoading={isChecking}
          disabled={isChecking}
        >
          Ping
        </Button>
      </header>

      <div className="mt-3 flex flex-col gap-2">
        <Row label="Status">
          <Badge tone={tone} dot pill>
            {label}
          </Badge>
        </Row>
        <Row label="Response">
          {state.latencyMs !== null ? `${state.latencyMs} ms` : '—'}
        </Row>
        <Row label="Last checked">{timeLabel(state.lastChecked)}</Row>
      </div>

      {state.error && state.status === 'down' && (
        <div className="mt-3">
          <ErrorBanner message={state.error} onRetry={onPing} />
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-label-md text-on-surface-variant">{label}</span>
      <span className="min-w-0 truncate text-right text-body-sm text-on-surface">
        {children}
      </span>
    </div>
  );
}
