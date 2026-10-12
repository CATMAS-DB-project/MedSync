import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/Select';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { DropdownMenu } from '../../../components/ui/DropdownMenu';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { EmptyState } from '../../../components/common/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useBranchNames } from '../../../hooks/useBranchNames';
import { fetchInvoices } from '../../../services/api/invoices';
import { fetchPatientById } from '../../../services/api/patients';
import { formatCurrency, formatDate, formatFullName } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import { InvoiceDetailDrawer } from '../components/InvoiceDetailDrawer';
import { PatientPicker } from '../../appointments/components/PatientPicker';
import type { Invoice, InvoiceStatus, Patient } from '../../../types';

const PAGE_SIZE = 10;

type TabValue = 'All' | 'Draft' | 'Finalized' | 'Partially Paid' | 'Paid' | 'Due';

const TAB_DEFS: { value: TabValue; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Finalized', label: 'Finalized' },
  { value: 'Partially Paid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Due', label: 'Balance due' },
];

function parseTab(raw: string | null): TabValue {
  if (
    raw === 'Draft' ||
    raw === 'Finalized' ||
    raw === 'Partially Paid' ||
    raw === 'Paid' ||
    raw === 'Due'
  ) {
    return raw;
  }
  return 'All';
}

function parseNumber(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

interface SelectedInvoiceState {
  id: number;
  focus: 'finalize' | 'payment' | null;
}

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';
  const isReceptionist = currentUser?.role === 'Receptionist';

  const tab = parseTab(searchParams.get('status'));
  const branchParam = parseNumber(searchParams.get('branchId'));
  const patientParam = parseNumber(searchParams.get('patientId'));
  const page = parsePage(searchParams.get('page'));

  const effectiveBranchId = useMemo(() => {
    if (isAdmin) return branchParam;
    return currentUser?.branchId;
  }, [isAdmin, branchParam, currentUser?.branchId]);

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

  const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoiceState | null>(
    null,
  );
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isPatientFilterOpen, setIsPatientFilterOpen] = useState(false);
  const patientFilterRef = useRef<HTMLDivElement>(null);
  const patientPreloadRef = useRef<number | null>(null);

  // Preload the patient for the URL filter (so the chip can display immediately).
  useEffect(() => {
    if (patientParam === undefined) {
      patientPreloadRef.current = null;
      setSelectedPatient(null);
      return;
    }
    if (patientPreloadRef.current === patientParam) return;
    patientPreloadRef.current = patientParam;
    fetchPatientById(patientParam)
      .then((p) => setSelectedPatient(p))
      .catch(() => setSelectedPatient(null));
  }, [patientParam]);

  // Close the patient filter popover on outside click.
  useEffect(() => {
    if (!isPatientFilterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!patientFilterRef.current?.contains(e.target as Node)) {
        setIsPatientFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isPatientFilterOpen]);

  const { branches, getBranchName } = useBranchNames();

  const branchOptions = useMemo(() => {
    const opts = [{ label: 'All branches', value: '' }];
    for (const b of branches) {
      opts.push({ label: b.branchName, value: String(b.branchId) });
    }
    return opts;
  }, [branches]);

  // Main list — different code path for the Due tab (client-side pagination).
  const invoices = useAsync(async () => {
    if (tab === 'Due') {
      const [finalized, partiallyPaid] = await Promise.all([
        fetchInvoices({
          status: 'Finalized',
          branchId: effectiveBranchId,
          patientId: patientParam,
          page: 1,
          pageSize: 100,
        }),
        fetchInvoices({
          status: 'Partially Paid',
          branchId: effectiveBranchId,
          patientId: patientParam,
          page: 1,
          pageSize: 100,
        }),
      ]);
      const all = [...finalized.items, ...partiallyPaid.items]
        .filter((i) => (i.outstandingAmount ?? 0) > 0)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      const start = (page - 1) * PAGE_SIZE;
      const paged = all.slice(start, start + PAGE_SIZE);
      return { items: paged, total: all.length, page, pageSize: PAGE_SIZE };
    }

    const statusParam: InvoiceStatus | undefined =
      tab === 'All' ? undefined : (tab as InvoiceStatus);

    return fetchInvoices({
      status: statusParam,
      branchId: effectiveBranchId,
      patientId: patientParam,
      page,
      pageSize: PAGE_SIZE,
    });
  }, [tab, effectiveBranchId, patientParam, page]);

  // Cheap counts (pageSize: 1). Skipped for the Due tab (derived filter).
  const counts = useAsync<Partial<Record<TabValue, number>>>(async () => {
    const base = { branchId: effectiveBranchId, patientId: patientParam, page: 1, pageSize: 1 };
    const [all, draft, finalized, partiallyPaid, paid] = await Promise.all([
      fetchInvoices(base),
      fetchInvoices({ ...base, status: 'Draft' }),
      fetchInvoices({ ...base, status: 'Finalized' }),
      fetchInvoices({ ...base, status: 'Partially Paid' }),
      fetchInvoices({ ...base, status: 'Paid' }),
    ]);
    return {
      All: all.total,
      Draft: draft.total,
      Finalized: finalized.total,
      'Partially Paid': partiallyPaid.total,
      Paid: paid.total,
    };
  }, [effectiveBranchId, patientParam]);

  const rows = invoices.data?.items ?? [];
  const total = invoices.data?.total ?? 0;
  const isFirstLoad = invoices.isLoading && invoices.data === undefined;

  const tabItems: TabItem<TabValue>[] = TAB_DEFS.map((t) => {
    const count = counts.data?.[t.value];
    return {
      value: t.value,
      label: count !== undefined ? `${t.label} (${count})` : t.label,
    };
  });

  const hasActiveFilters =
    tab !== 'All' || patientParam !== undefined || (isAdmin && branchParam !== undefined);

  const handleClearFilters = () => {
    updateParams({ status: null, patientId: null, branchId: null, page: null });
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      primary: true,
      cell: (row) => {
        const resolvedBranchName = row.branchName ?? getBranchName(row.branchId);
        return (
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-table-data font-medium text-primary">
              #{row.invoiceId}
            </span>
            <span className="text-label-md text-on-surface-variant">
              {formatDate(row.createdAt)}
              {resolvedBranchName ? ` · ${resolvedBranchName}` : ''}
            </span>
          </div>
        );
      },
    },
    {
      key: 'patient',
      header: 'Patient',
      secondary: true,
      cell: (row) => {
        const name = row.patientName ?? `Patient #${row.patientId ?? '—'}`;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={name} size="xs" />
            <span className="truncate">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'payable',
      header: 'Payable',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.payableAmount ?? row.subtotalAmount),
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => formatCurrency(row.amountPaid ?? 0),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => {
        const outstanding = row.outstandingAmount ?? 0;
        const isProblem = outstanding > 0 && row.status !== 'Draft';
        if (outstanding === 0) {
          return <span className="text-on-surface-variant">—</span>;
        }
        return (
          <span className={isProblem ? 'font-semibold text-error' : 'text-on-surface-variant'}>
            {formatCurrency(outstanding)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={INVOICE_STATUS_TONE[row.status]} dot pill>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader title="Billing" />

      <Card padding="md" className="overflow-visible">
        <div className="flex flex-col gap-3">
          <Tabs<TabValue>
            items={tabItems}
            value={tab}
            onChange={(next) =>
              updateParams({
                status: next === 'All' ? null : next,
                page: null,
              })
            }
            ariaLabel="Invoice status"
            className="self-start"
          />

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="w-56">
                <Select
                  value={branchParam !== undefined ? String(branchParam) : ''}
                  onChange={(e) =>
                    updateParams({ branchId: e.target.value || null, page: null })
                  }
                  options={branchOptions}
                  aria-label="Branch filter"
                />
              </div>
            )}

            <div className="relative" ref={patientFilterRef}>
              {patientParam !== undefined && selectedPatient ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 text-label-md font-medium text-on-primary-container">
                  <Avatar
                    name={formatFullName(
                      selectedPatient.firstName,
                      selectedPatient.lastName,
                    )}
                    size="xs"
                  />
                  <span className="max-w-[10rem] truncate">
                    {formatFullName(selectedPatient.firstName, selectedPatient.lastName)}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove patient filter"
                    onClick={() => {
                      patientPreloadRef.current = null;
                      setSelectedPatient(null);
                      updateParams({ patientId: null, page: null });
                    }}
                    className="rounded-full p-0.5 hover:bg-on-primary-container/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="person_search"
                  onClick={() => setIsPatientFilterOpen((v) => !v)}
                >
                  Filter by patient
                </Button>
              )}

              {isPatientFilterOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-80 rounded-2xl bg-surface-container-lowest p-4 shadow-popover">
                  <PatientPicker
                    value={selectedPatient}
                    onChange={(p) => {
                      setSelectedPatient(p);
                      patientPreloadRef.current = p ? p.patientId : null;
                      updateParams({
                        patientId: p ? String(p.patientId) : null,
                        page: null,
                      });
                      setIsPatientFilterOpen(false);
                    }}
                    initialPatientId={patientParam ?? null}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div
        className={
          invoices.isLoading && invoices.data !== undefined
            ? 'opacity-60 transition-opacity'
            : 'transition-opacity'
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.invoiceId)}
          onRowClick={(row) => setSelectedInvoice({ id: row.invoiceId, focus: null })}
          loading={isFirstLoad}
          error={invoices.error}
          onRetry={invoices.reload}
          skeletonRows={PAGE_SIZE}
          emptyState={
            hasActiveFilters ? (
              <EmptyState
                icon="receipt_long"
                title="No invoices"
                action={
                  <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState icon="receipt_long" title="No invoices" />
            )
          }
          rowActions={(row) => (
            <DropdownMenu
              ariaLabel="Invoice actions"
              trigger={
                <IconButton icon="more_horiz" size="sm" aria-label="Actions" />
              }
              items={[
                {
                  id: 'view',
                  label: 'View',
                  icon: 'visibility',
                  onSelect: () =>
                    setSelectedInvoice({ id: row.invoiceId, focus: null }),
                },
                ...(isReceptionist && row.status === 'Draft'
                  ? [
                      {
                        id: 'finalize',
                        label: 'Finalize',
                        icon: 'done_all',
                        onSelect: () =>
                          setSelectedInvoice({
                            id: row.invoiceId,
                            focus: 'finalize',
                          }),
                      },
                    ]
                  : []),
                ...(isReceptionist &&
                (row.status === 'Finalized' || row.status === 'Partially Paid')
                  ? [
                      {
                        id: 'payment',
                        label: 'Record payment',
                        icon: 'payments',
                        onSelect: () =>
                          setSelectedInvoice({
                            id: row.invoiceId,
                            focus: 'payment',
                          }),
                      },
                    ]
                  : []),
              ]}
            />
          )}
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
      </div>

      <InvoiceDetailDrawer
        invoiceId={selectedInvoice?.id ?? null}
        initialFocus={selectedInvoice?.focus ?? null}
        onClose={() => setSelectedInvoice(null)}
        onChanged={invoices.reload}
      />
    </div>
  );
}
