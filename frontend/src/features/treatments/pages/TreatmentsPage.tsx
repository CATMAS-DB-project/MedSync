import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Pagination } from '../../../components/common/Pagination';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import {
  createTreatment,
  fetchTreatments,
  updateTreatment,
} from '../../../services/api/treatments';
import { invalidateTreatmentsCache } from '../../consultation/fetchAllTreatments';
import { formatCurrency } from '../../../utils/formatters';
import type { TreatmentCatalogueItem } from '../../../types';

const PAGE_SIZE = 10;
const FETCH_BATCH_SIZE = 100;

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Consultation',
  'Diagnostics',
  'Laboratory',
  'Procedures',
  'Radiology',
];

interface TreatmentFormState {
  serviceCode: string;
  treatmentName: string;
  category: string;
  unitPrice: string;
}

interface TreatmentFieldErrors {
  serviceCode?: string;
  treatmentName?: string;
  category?: string;
  unitPrice?: string;
}

function emptyForm(): TreatmentFormState {
  return {
    serviceCode: '',
    treatmentName: '',
    category: '',
    unitPrice: '',
  };
}

async function loadAllTreatmentsCatalogue(): Promise<TreatmentCatalogueItem[]> {
  const first = await fetchTreatments(undefined, 1, FETCH_BATCH_SIZE);
  const totalPages = Math.max(1, Math.ceil(first.total / FETCH_BATCH_SIZE));
  if (totalPages === 1) {
    return first.items;
  }
  const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await Promise.all(
    restPages.map((p) => fetchTreatments(undefined, p, FETCH_BATCH_SIZE)),
  );
  return [...first.items, ...rest.flatMap((r) => r.items)];
}

export function TreatmentsPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManage =
    currentUser?.role === 'Admin' || currentUser?.role === 'Branch Manager';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [page, setPage] = useState(1);

  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<TreatmentCatalogueItem | null>(
    null,
  );
  const [form, setForm] = useState<TreatmentFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<TreatmentFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const catalogue = useAsync(() => loadAllTreatmentsCatalogue(), []);
  const items = catalogue.data ?? [];
  const isFirstLoad = catalogue.isLoading && catalogue.data === undefined;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.category?.trim()) {
        set.add(item.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CATEGORY_SUGGESTIONS, ...categories]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const categoryTabs: TabItem[] = useMemo(
    () => [
      { value: 'All', label: `All (${items.length})` },
      ...categories.map((cat) => {
        const count = items.filter((t) => t.category === cat).length;
        return { value: cat, label: `${cat} (${count})` };
      }),
    ],
    [items, categories],
  );

  // Reset to "All" if selected category no longer exists
  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.serviceCode.toLowerCase().includes(normalizedQuery) ||
        item.treatmentName.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [items, selectedCategory, query]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedCategory]);

  const openCreateDrawer = useCallback(() => {
    setEditingItem(null);
    setForm({
      serviceCode: '',
      treatmentName: '',
      category: selectedCategory !== 'All' ? selectedCategory : '',
      unitPrice: '',
    });
    setFieldErrors({});
    setSubmitError(null);
    setDrawerMode('create');
  }, [selectedCategory]);

  const openEditDrawer = useCallback((item: TreatmentCatalogueItem) => {
    setEditingItem(item);
    setForm({
      serviceCode: item.serviceCode,
      treatmentName: item.treatmentName,
      category: item.category,
      unitPrice: String(Number(item.unitPrice)),
    });
    setFieldErrors({});
    setSubmitError(null);
    setDrawerMode('edit');
  }, []);

  const closeDrawer = useCallback(() => {
    if (isSubmitting) return;
    setDrawerMode(null);
    setEditingItem(null);
  }, [isSubmitting]);

  const setField = <K extends keyof TreatmentFormState>(
    key: K,
    value: TreatmentFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canManage || isSubmitting || drawerMode === null) return;
    setSubmitError(null);

    const errors: TreatmentFieldErrors = {};
    const trimmedCode = form.serviceCode.trim().toUpperCase();
    const trimmedName = form.treatmentName.trim();
    const trimmedCategory = form.category.trim();
    const rawPrice = form.unitPrice.trim();
    const parsedPrice = Number(rawPrice);

    if (drawerMode === 'create') {
      if (!trimmedCode) {
        errors.serviceCode = 'Service code is required';
      } else if (trimmedCode.length > 10) {
        errors.serviceCode = 'Service code must be 10 characters or fewer';
      }
    }

    if (!trimmedName) {
      errors.treatmentName = 'Treatment name is required';
    } else if (trimmedName.length > 100) {
      errors.treatmentName = 'Treatment name must be 100 characters or fewer';
    }

    if (!trimmedCategory) {
      errors.category = 'Category is required';
    } else if (trimmedCategory.length > 50) {
      errors.category = 'Category must be 50 characters or fewer';
    }

    if (rawPrice === '' || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      errors.unitPrice = 'Enter a valid unit price (0 or more)';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (drawerMode === 'create') {
        await createTreatment({
          serviceCode: trimmedCode,
          treatmentName: trimmedName,
          category: trimmedCategory,
          unitPrice: parsedPrice,
        });
        toast.success(`Treatment ${trimmedCode} added to catalogue`);
      } else if (editingItem) {
        await updateTreatment(editingItem.serviceCode, {
          treatmentName: trimmedName,
          category: trimmedCategory,
          unitPrice: parsedPrice,
        });
        toast.success(`Updated ${editingItem.serviceCode}`);
      }

      invalidateTreatmentsCache();
      setDrawerMode(null);
      setEditingItem(null);
      catalogue.reload();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError(
            `A treatment with service code "${trimmedCode}" already exists.`,
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Unable to save treatment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: DataTableColumn<TreatmentCatalogueItem>[] = [
    {
      key: 'code',
      header: 'Service Code',
      primary: true,
      cell: (row) => (
        <span className="font-mono text-table-data font-semibold text-primary">
          {row.serviceCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Treatment Name',
      secondary: true,
      cell: (row) => (
        <span className="font-medium text-on-surface">{row.treatmentName}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      cell: (row) => (
        <Badge tone="info" pill>
          {row.category}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Unit Price',
      align: 'right',
      cell: (row) => (
        <span className="font-mono font-semibold text-on-surface">
          {formatCurrency(Number(row.unitPrice))}
        </span>
      ),
    },
  ];

  const hasFilters = query.trim() !== '' || selectedCategory !== 'All';

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Treatment Catalogue"
        actions={
          canManage ? (
            <Button
              variant="primary"
              icon="add"
              onClick={openCreateDrawer}
            >
              Add treatment
            </Button>
          ) : undefined
        }
      />

      <Card padding="md">
        <div className="flex flex-col gap-4">
          {categoryTabs.length > 1 && (
            <Tabs
              items={categoryTabs}
              value={selectedCategory}
              onChange={setSelectedCategory}
              ariaLabel="Treatment categories"
              className="self-start"
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md">
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                placeholder="Search by service code, treatment name, or category…"
              />
            </div>
            <span className="text-label-md text-on-surface-variant">
              Showing {filteredItems.length} of {items.length} treatments
              {canManage ? ' · Click a row to edit price or details' : ''}
            </span>
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => row.serviceCode}
        onRowClick={canManage ? openEditDrawer : undefined}
        loading={isFirstLoad}
        error={catalogue.error}
        onRetry={catalogue.reload}
        skeletonRows={PAGE_SIZE}
        emptyState={
          hasFilters ? (
            <EmptyState
              icon="medical_services"
              title="No matching treatments"
              description="Try clearing your search or category filter."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setSelectedCategory('All');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="medical_services"
              title="No treatments in catalogue"
              description="Add your first clinical treatment and unit price."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="add"
                    onClick={openCreateDrawer}
                  >
                    Add treatment
                  </Button>
                ) : undefined
              }
            />
          )
        }
        pagination={
          filteredItems.length > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filteredItems.length}
              onPageChange={setPage}
            />
          ) : undefined
        }
      />

      <Drawer
        isOpen={drawerMode !== null}
        onClose={closeDrawer}
        title={
          drawerMode === 'edit' && editingItem
            ? `Edit ${editingItem.serviceCode}`
            : 'Add New Treatment'
        }
        subtitle={
          drawerMode === 'edit' && editingItem
            ? editingItem.treatmentName
            : 'Register a treatment code and standard unit price in the catalogue.'
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeDrawer}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={drawerMode === 'edit' ? 'save' : 'add'}
              onClick={handleSave}
              isLoading={isSubmitting}
            >
              {drawerMode === 'edit' ? 'Save changes' : 'Create treatment'}
            </Button>
          </>
        }
      >
        {submitError && <ErrorBanner message={submitError} />}

        <DrawerSection title="Treatment Details" icon="medical_services">
          <div className="flex flex-col gap-4">
            <Input
              label="Service Code"
              placeholder="e.g. CON-003"
              maxLength={10}
              value={form.serviceCode}
              disabled={drawerMode === 'edit'}
              onChange={(e) =>
                setField('serviceCode', e.target.value.toUpperCase())
              }
              error={fieldErrors.serviceCode}
              hint={
                drawerMode === 'edit'
                  ? 'Service code is a primary identifier and cannot be changed.'
                  : 'Unique code up to 10 characters (e.g. BLD-001, CON-001).'
              }
            />

            <Input
              label="Treatment Name"
              placeholder="e.g. Specialist Consultation"
              maxLength={100}
              value={form.treatmentName}
              onChange={(e) => setField('treatmentName', e.target.value)}
              error={fieldErrors.treatmentName}
            />

            <div className="flex flex-col gap-2">
              <Input
                label="Category"
                placeholder="e.g. Consultation, Laboratory, Diagnostics"
                maxLength={50}
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                error={fieldErrors.category}
              />
              {categorySuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-label-sm text-on-surface-variant">
                    Quick select:
                  </span>
                  {categorySuggestions.map((cat) => {
                    const active = form.category.trim() === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setField('category', cat)}
                        className={
                          active
                            ? 'rounded-full bg-primary-container px-2.5 py-0.5 text-label-sm font-semibold text-on-primary-container transition-colors'
                            : 'rounded-full bg-surface-container-low px-2.5 py-0.5 text-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors'
                        }
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Pricing" icon="payments">
          <div className="flex flex-col gap-3">
            <Input
              label="Unit Price (LKR)"
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 1500.00"
              value={form.unitPrice}
              onChange={(e) => setField('unitPrice', e.target.value)}
              error={fieldErrors.unitPrice}
              hint="Updated prices apply to new treatments logged during consultations. Existing recorded treatments keep their historical price."
            />
          </div>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
