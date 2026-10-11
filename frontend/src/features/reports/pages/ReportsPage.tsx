import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { fetchBranches } from '../../../services/api/branches';
import { fetchTreatments } from '../../../services/api/treatments';
import {
  downloadAppointmentsSummaryPdf,
  downloadDoctorRevenuePdf,
  downloadInsuranceSummaryPdf,
  downloadOutstandingBalancesPdf,
  downloadTreatmentFrequencyPdf,
  fetchAppointmentsSummary,
  fetchDoctorRevenue,
  fetchInsuranceVsOutOfPocket,
  fetchOutstandingBalances,
  fetchTreatmentFrequency,
} from '../../../services/api/reports';
import { todayIso, daysAgoIso, toIsoDate } from '../../../utils/dates';
import { InvoiceDetailDrawer } from '../../billing/components/InvoiceDetailDrawer';
import { ReportAppointmentsTab } from '../components/ReportAppointmentsTab';
import { ReportDoctorRevenueTab } from '../components/ReportDoctorRevenueTab';
import { ReportOutstandingTab } from '../components/ReportOutstandingTab';
import { ReportTreatmentsTab } from '../components/ReportTreatmentsTab';
import { ReportInsuranceTab } from '../components/ReportInsuranceTab';
import type { AppointmentSummaryReportItem, DoctorRevenueReportItem, InsuranceVsOutOfPocketReport, OutstandingBalanceReportItem, TreatmentFrequencyReportItem } from '../../../services/api/reports';

type TabValue = 'appointments' | 'doctor-revenue' | 'outstanding' | 'treatments' | 'insurance';
type PresetValue = '7d' | '30d' | '90d' | 'month' | 'custom';

const TAB_ITEMS: TabItem<TabValue>[] = [
  { value: 'appointments', label: 'Appointments' },
  { value: 'doctor-revenue', label: 'Doctor revenue' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'treatments', label: 'Treatments' },
  { value: 'insurance', label: 'Insurance' },
];

const PRESET_ITEMS: TabItem<PresetValue>[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseTab(v: string | null): TabValue {
  if (
    v === 'appointments' ||
    v === 'doctor-revenue' ||
    v === 'outstanding' ||
    v === 'treatments' ||
    v === 'insurance'
  ) {
    return v;
  }
  return 'appointments';
}

function parseDate(v: string | null, fallback: string): string {
  return v && ISO_DATE.test(v) ? v : fallback;
}

function parseId(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function firstOfMonthIso(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function presetRange(preset: PresetValue): { from: string; to: string } {
  const to = todayIso();
  switch (preset) {
    case '7d':
      return { from: daysAgoIso(6), to };
    case '30d':
      return { from: daysAgoIso(29), to };
    case '90d':
      return { from: daysAgoIso(89), to };
    case 'month':
      return { from: firstOfMonthIso(), to };
    case 'custom':
      return { from: daysAgoIso(29), to };
  }
}

function detectPreset(from: string, to: string): PresetValue {
  if (to !== todayIso()) return 'custom';
  if (from === daysAgoIso(6)) return '7d';
  if (from === daysAgoIso(29)) return '30d';
  if (from === daysAgoIso(89)) return '90d';
  if (from === firstOfMonthIso()) return 'month';
  return 'custom';
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const toast = useToast();

  const isBranchManager = currentUser?.role === 'Branch Manager';
  const isAdmin = currentUser?.role === 'Admin';

  if (!isAdmin && !isBranchManager) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Access restricted" />
      </div>
    );
  }

  const tab = parseTab(searchParams.get('tab'));
  const from = parseDate(searchParams.get('from'), daysAgoIso(29));
  const to = parseDate(searchParams.get('to'), todayIso());
  const branchParam = parseId(searchParams.get('branchId'));
  const category = searchParams.get('category') ?? '';

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

  const preset = useMemo(() => detectPreset(from, to), [from, to]);

  const effectiveBranchId = isBranchManager
    ? currentUser?.branchId
    : branchParam;

  // Lazy activation of each tab so we don't fetch all reports upfront.
  const [activated, setActivated] = useState<Set<TabValue>>(
    () => new Set<TabValue>([tab]),
  );
  useEffect(() => {
    setActivated((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  const activeAppointments = activated.has('appointments');
  const activeDoctorRevenue = activated.has('doctor-revenue');
  const activeOutstanding = activated.has('outstanding');
  const activeTreatments = activated.has('treatments');
  const activeInsurance = activated.has('insurance');

  const branches = useAsync(
    () => (isAdmin ? fetchBranches(1, 100) : Promise.resolve(null)),
    [isAdmin],
  );

  const branchOptions = useMemo(() => {
    const opts = [{ label: 'All branches', value: '' }];
    for (const b of branches.data?.items ?? []) {
      opts.push({ label: b.branchName, value: String(b.branchId) });
    }
    return opts;
  }, [branches.data]);

  const catalogue = useAsync(
    () => (activeTreatments ? fetchTreatments(undefined, 1, 100) : Promise.resolve(null)),
    [activeTreatments],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of catalogue.data?.items ?? []) if (t.category) set.add(t.category);
    return [
      { label: 'All categories', value: '' },
      ...[...set].sort().map((c) => ({ label: c, value: c })),
    ];
  }, [catalogue.data]);

  const appointments = useAsync<AppointmentSummaryReportItem[]>(
    () =>
      activeAppointments
        ? fetchAppointmentsSummary({
            branchId: effectiveBranchId,
            from,
            to,
          })
        : Promise.resolve([] as AppointmentSummaryReportItem[]),
    [activeAppointments, effectiveBranchId, from, to],
  );

  const doctorRevenue = useAsync<DoctorRevenueReportItem[]>(
    () =>
      activeDoctorRevenue
        ? fetchDoctorRevenue({ branchId: effectiveBranchId, from, to })
        : Promise.resolve([] as DoctorRevenueReportItem[]),
    [activeDoctorRevenue, effectiveBranchId, from, to],
  );

  const outstanding = useAsync<OutstandingBalanceReportItem[]>(
    () =>
      activeOutstanding
        ? fetchOutstandingBalances({ branchId: effectiveBranchId })
        : Promise.resolve([] as OutstandingBalanceReportItem[]),
    [activeOutstanding, effectiveBranchId],
  );

  const treatments = useAsync<TreatmentFrequencyReportItem[]>(
    () =>
      activeTreatments
        ? fetchTreatmentFrequency({
            branchId: effectiveBranchId,
            category: category || undefined,
            from,
            to,
          })
        : Promise.resolve([] as TreatmentFrequencyReportItem[]),
    [activeTreatments, effectiveBranchId, category, from, to],
  );

  const insurance = useAsync<InsuranceVsOutOfPocketReport | null>(
    () =>
      activeInsurance
        ? fetchInsuranceVsOutOfPocket({ branchId: effectiveBranchId, from, to })
        : Promise.resolve(null),
    [activeInsurance, effectiveBranchId, from, to],
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      let blob: Blob;
      let filename: string;
      switch (tab) {
        case 'appointments':
          blob = await downloadAppointmentsSummaryPdf({ branchId: effectiveBranchId, from, to });
          filename = `medsync-appointments-${from}-${to}.pdf`;
          break;
        case 'doctor-revenue':
          blob = await downloadDoctorRevenuePdf({ branchId: effectiveBranchId, from, to });
          filename = `medsync-doctor-revenue-${from}-${to}.pdf`;
          break;
        case 'outstanding':
          blob = await downloadOutstandingBalancesPdf({ branchId: effectiveBranchId });
          filename = 'medsync-outstanding.pdf';
          break;
        case 'treatments':
          blob = await downloadTreatmentFrequencyPdf({
            branchId: effectiveBranchId,
            category: category || undefined,
            from,
            to,
          });
          filename = `medsync-treatments-${from}-${to}.pdf`;
          break;
        case 'insurance':
          blob = await downloadInsuranceSummaryPdf({ branchId: effectiveBranchId, from, to });
          filename = `medsync-insurance-${from}-${to}.pdf`;
          break;
      }
      saveBlob(blob, filename);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Could not download the PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const presetRangeFor = (p: PresetValue) => presetRange(p);

  const showDateControls = tab !== 'outstanding';
  const showCategorySelect = tab === 'treatments';

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader title="Reports" />

      <div className="-mx-1 overflow-x-auto px-1">
        <Tabs<TabValue>
          items={TAB_ITEMS}
          value={tab}
          onChange={(next) => updateParams({ tab: next })}
          ariaLabel="Report type"
        />
      </div>

      <Card padding="md">
        <div className="flex flex-col gap-3">
          {showDateControls && (
            <Tabs<PresetValue>
              items={PRESET_ITEMS}
              value={preset}
              onChange={(next) => {
                if (next === 'custom') {
                  updateParams({ from, to });
                } else {
                  const r = presetRangeFor(next);
                  updateParams({ from: r.from, to: r.to });
                }
              }}
              ariaLabel="Date range"
              className="self-start"
            />
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
              {showDateControls && preset === 'custom' && (
                <>
                  <div className="sm:w-44">
                    <Input
                      label="From"
                      type="date"
                      value={from}
                      max={to}
                      onChange={(e) => updateParams({ from: e.target.value })}
                    />
                  </div>
                  <div className="sm:w-44">
                    <Input
                      label="To"
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => updateParams({ to: e.target.value })}
                    />
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="sm:w-56">
                  <Select
                    label="Branch"
                    value={branchParam !== undefined ? String(branchParam) : ''}
                    onChange={(e) =>
                      updateParams({ branchId: e.target.value || null })
                    }
                    options={branchOptions}
                  />
                </div>
              )}

              {showCategorySelect && (
                <div className="sm:w-56">
                  <Select
                    label="Category"
                    value={category}
                    onChange={(e) =>
                      updateParams({ category: e.target.value || null })
                    }
                    options={categoryOptions}
                  />
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              icon="download"
              onClick={handleDownloadPdf}
              isLoading={isDownloading}
              disabled={isDownloading}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      {tab === 'appointments' && (
        <ReportAppointmentsTab
          data={appointments.data ?? []}
          loading={appointments.isLoading}
          error={appointments.error}
          onRetry={appointments.reload}
        />
      )}

      {tab === 'doctor-revenue' && (
        <ReportDoctorRevenueTab
          data={doctorRevenue.data ?? []}
          loading={doctorRevenue.isLoading}
          error={doctorRevenue.error}
          onRetry={doctorRevenue.reload}
        />
      )}

      {tab === 'outstanding' && (
        <ReportOutstandingTab
          data={outstanding.data ?? []}
          loading={outstanding.isLoading}
          error={outstanding.error}
          onRetry={outstanding.reload}
          onOpenInvoice={setSelectedInvoiceId}
        />
      )}

      {tab === 'treatments' && (
        <ReportTreatmentsTab
          data={treatments.data ?? []}
          loading={treatments.isLoading}
          error={treatments.error}
          onRetry={treatments.reload}
        />
      )}

      {tab === 'insurance' && (
        <ReportInsuranceTab
          data={insurance.data ?? null}
          loading={insurance.isLoading}
          error={insurance.error}
          onRetry={insurance.reload}
        />
      )}

      {tab === 'outstanding' && outstanding.error && (
        <ErrorBanner message={outstanding.error} onRetry={outstanding.reload} />
      )}

      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onChanged={outstanding.reload}
      />
    </div>
  );
}
