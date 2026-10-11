import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchAuditLogs } from '../../../services/api/auditLogs';
import { formatDate } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import { useSystemHealth } from '../useSystemHealth';
import { useDataChecks } from '../useDataChecks';
import { QaStatCard } from '../components/QaStatCard';
import { QaVerificationPanel } from '../components/QaVerificationPanel';
import { AuditLogPanel } from '../../audit/components/AuditLogPanel';
import type { AuditLogEntry, PagedResult } from '../../../types';

type QaTab = 'audit' | 'checks';

const TAB_ITEMS: TabItem<QaTab>[] = [
  { value: 'audit', label: 'Audit log' },
  { value: 'checks', label: 'Data checks' },
];

function parseTab(value: string | null): QaTab {
  return value === 'checks' ? 'checks' : 'audit';
}

export function QAHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isQa = currentUser?.role === 'QA Tester';
  const today = todayIso();

  const health = useSystemHealth(isQa);
  const checks = useDataChecks(isQa);

  const auditToday = useAsync<PagedResult<AuditLogEntry>>(
    () =>
      isQa
        ? fetchAuditLogs({
            from: `${today}T00:00:00Z`,
            to: `${today}T23:59:59Z`,
            page: 1,
            pageSize: 1,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 1 }),
    [isQa, today],
  );

  const tab = parseTab(searchParams.get('tab'));

  const updateTab = useCallback(
    (next: QaTab) => {
      const sp = new URLSearchParams(searchParams);
      if (next === 'audit') sp.delete('tab');
      else sp.set('tab', next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const goToAuditToday = useCallback(() => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('tab');
    sp.set('from', today);
    sp.set('to', today);
    sp.delete('page');
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams, today]);

  if (!isQa || !currentUser) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Access restricted" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const systemStatus = health.state.status;
  const systemValue =
    systemStatus === 'ok' ? 'Online' : systemStatus === 'down' ? 'Down' : '—';
  const systemDot: 'success' | 'error' | 'neutral' =
    systemStatus === 'ok' ? 'success' : systemStatus === 'down' ? 'error' : 'neutral';

  const dataIssueCount = checks.anomalies.length;

  const systemLoading = systemStatus === 'idle' && health.isChecking;
  const checksLoading = checks.isLoading && checks.anomalies.length === 0;
  const auditLoading = auditToday.isLoading && auditToday.data === undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">
          {greeting}, {currentUser.firstName || 'QA Tester'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" pill>
            <Icon name="today" size={12} />
            {formatDate(today)}
          </Badge>
          <Badge tone="secondary" pill>
            QA Tester
          </Badge>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <QaStatCard
          label="System"
          value={systemValue}
          description={
            health.state.latencyMs !== null ? `${health.state.latencyMs} ms` : undefined
          }
          dotTone={systemDot}
          loading={systemLoading}
          error={systemStatus === 'down' ? health.state.error : null}
          onRetry={health.check}
        />
        <QaStatCard
          label="Data issues"
          value={checksLoading ? '—' : dataIssueCount.toLocaleString()}
          dotTone={dataIssueCount > 0 ? 'warning' : 'success'}
          valueTone={dataIssueCount > 0 ? 'warning' : 'success'}
          loading={checksLoading}
          error={checks.error}
          onRetry={checks.reload}
          onClick={() => updateTab('checks')}
        />
        <QaStatCard
          label="Audit events today"
          value={auditToday.data ? auditToday.data.total.toLocaleString() : '—'}
          loading={auditLoading}
          error={auditToday.error}
          onRetry={auditToday.reload}
          onClick={goToAuditToday}
        />
      </section>

      <Tabs<QaTab>
        items={TAB_ITEMS}
        value={tab}
        onChange={updateTab}
        ariaLabel="QA workspace sections"
        className="self-start"
      />

      {tab === 'audit' && <AuditLogPanel />}
      {tab === 'checks' && <QaVerificationPanel checks={checks} health={health} />}
    </div>
  );
}
