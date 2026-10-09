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
    <div className="mx-auto max-w-7xl flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-outline-variant pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-body-sm text-on-surface-variant">Quality Assurance Workspace</span>
            <Badge tone="secondary">QA Tester</Badge>
          </div>
          <h1 className="text-display-sm text-on-surface">
            {greeting}, {currentUser.firstName || currentUser.username || 'QA Tester'}
          </h1>
        </div>
        <div className="flex flex-col items-start gap-0.5 text-body-sm text-on-surface-variant sm:items-end">
          <span>{formatDate(today)}</span>
          <span className="text-xs text-outline">Branch: {currentUser.branchName}</span>
        </div>
      </header>

      {/* Feature Verification & System Health */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm text-on-surface">Feature Verification &amp; System Status</h2>
          <span className="text-label-md text-on-surface-variant">System Health &amp; Reference Audit</span>
        </div>
        <QaVerificationPanel />
      </section>

      {/* Database Audit Panel */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm text-on-surface">Database Audit Panel</h2>
          <span className="text-label-md text-on-surface-variant">Audit Logs &amp; Mutation Tracking</span>
        </div>
        <AuditLogPanel />
      </section>
    </div>
  );
}
