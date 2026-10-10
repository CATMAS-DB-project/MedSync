import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/ui/Badge';
import { formatDate } from '../../../utils/formatters';
import { todayIso } from '../../../utils/dates';
import { AuditLogPanel } from '../../audit/components/AuditLogPanel';
import { QaVerificationPanel } from '../components/QaVerificationPanel';

export function QAHomePage() {
  const { currentUser } = useAuth();
  const today = todayIso();

  if (!currentUser || currentUser.role !== 'QA Tester') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-display-sm text-on-surface">QA Workspace</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">Access restricted to QA testers.</p>
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">fact_check</span>
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Quality assurance workspace</span>
              <Badge tone="secondary">QA Tester</Badge>
            </div>
            <h1 className="text-display-sm text-white">
              {greeting}, {currentUser.firstName || currentUser.username || 'QA Tester'}
            </h1>
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-start gap-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left text-body-sm text-white/85">
          <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px]" aria-hidden="true">today</span>{formatDate(today)}</span>
          <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px]" aria-hidden="true">location_on</span>{currentUser.branchName}</span>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 border-l-4 border-primary pl-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-label-md font-semibold uppercase tracking-wider text-primary">Platform checks</p>
            <h2 className="text-headline-sm text-on-surface">Feature Verification &amp; System Status</h2>
          </div>
          <span className="text-body-sm text-on-surface-variant">System health &amp; reference audit</span>
        </div>
        <QaVerificationPanel />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 border-l-4 border-secondary pl-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-label-md font-semibold uppercase tracking-wider text-secondary">Data integrity</p>
            <h2 className="text-headline-sm text-on-surface">Database Audit Panel</h2>
          </div>
          <span className="text-body-sm text-on-surface-variant">Audit logs &amp; mutation tracking</span>
        </div>
        <AuditLogPanel />
      </section>
    </div>
  );
}
