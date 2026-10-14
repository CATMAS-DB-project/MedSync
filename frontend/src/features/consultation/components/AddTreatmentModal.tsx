import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui/Button';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Tabs } from '../../../components/ui/Tabs';
import type { TabItem } from '../../../components/ui/Tabs';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { Icon } from '../../../components/ui/Icon';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { logAppointmentTreatments } from '../../../services/api/appointmentTreatments';
import { formatCurrency } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import type {
  BatchTreatmentCreateResult,
  TreatmentCatalogueItem,
} from '../../../types';
import { fetchAllTreatments } from '../fetchAllTreatments';

export interface AddTreatmentModalProps {
  isOpen: boolean;
  appointmentId: number;
  onClose: () => void;
  onAdded: (result: BatchTreatmentCreateResult) => void;
}

export function AddTreatmentModal({
  isOpen,
  appointmentId,
  onClose,
  onAdded,
}: AddTreatmentModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogue = useAsync(
    () => (isOpen ? fetchAllTreatments() : Promise.resolve([] as TreatmentCatalogueItem[])),
    [isOpen],
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategory('All');
      setSelectedCodes([]);
      setError(null);
    }
  }, [isOpen]);

  const items = catalogue.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of items) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [items]);

  const categoryTabs: TabItem[] = useMemo(
    () => [
      { value: 'All', label: 'All' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (!q) return true;
      return `${t.treatmentName} ${t.serviceCode}`.toLowerCase().includes(q);
    });
  }, [items, query, category]);

  const handleSubmit = async () => {
    if (selectedCodes.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await logAppointmentTreatments(
        appointmentId,
        selectedCodes.map((serviceCode) => ({ serviceCode })),
      );
      if (result.created.length > 0) {
        onAdded(result);
      }

      if (result.failed.length === 0) {
        onClose();
        return;
      }

      const failedCodes = new Set(
        result.failed
          .map((failure) => failure.serviceCode)
          .filter((code): code is string => Boolean(code)),
      );
      setSelectedCodes((codes) => codes.filter((code) => failedCodes.has(code)));
      setError(
        result.failed
          .map((failure) =>
            failure.serviceCode
              ? `${failure.serviceCode}: ${failure.error}`
              : failure.error,
          )
          .join(' '),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log the treatment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Add treatment"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={selectedCodes.length === 0 || isSubmitting}
            isLoading={isSubmitting}
          >
            Add {selectedCodes.length > 0 ? `${selectedCodes.length} ` : ''}treatment
            {selectedCodes.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
          placeholder="Search by name or code"
          aria-label="Search treatments"
        />

        {categoryTabs.length > 1 && (
          <Tabs
            items={categoryTabs}
            value={category}
            onChange={(next) => setCategory(next)}
            ariaLabel="Treatment category"
            className="self-start"
          />
        )}

        <div className="max-h-[420px] overflow-y-auto rounded-xl bg-surface-container-low p-2">
          {catalogue.error ? (
            <div className="p-2">
              <ErrorBanner message={catalogue.error} onRetry={catalogue.reload} />
            </div>
          ) : catalogue.isLoading && items.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={52} rounded="xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="search_off" title="No treatments match" />
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((t) => {
                const isSelected = selectedCodes.includes(t.serviceCode);
                return (
                  <li key={t.serviceCode}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCodes((codes) =>
                          isSelected
                            ? codes.filter((code) => code !== t.serviceCode)
                            : [...codes, t.serviceCode],
                        )
                      }
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low',
                        isSelected
                          ? 'bg-primary-container/60'
                          : 'hover:bg-surface-container-high',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-body-sm font-medium text-on-surface">
                          {t.treatmentName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
                          <span className="font-mono">{t.serviceCode}</span>
                          {t.category && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{t.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-body-sm text-on-surface">
                          {formatCurrency(t.unitPrice)}
                        </span>
                        {isSelected && (
                          <Icon name="check_circle" filled size={18} className="text-primary" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
