import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Avatar } from '../../../components/ui/Avatar';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchPatients } from '../../../services/api/patients';
import { formatFullName } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import { ROUTES } from '../../../constants/routes';

export interface ReceptionPatientSearchProps {
  onSelectPatient: (patientId: number) => void;
}

export function ReceptionPatientSearch({ onSelectPatient }: ReceptionPatientSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmed = debouncedQuery.trim();

  const search = useAsync(
    () =>
      trimmed.length === 0
        ? Promise.resolve(null)
        : fetchPatients({ search: trimmed, pageSize: 6 }),
    [trimmed],
  );

  const results = search.data?.items ?? [];
  const totalOptions = results.length + 1; // + "Register new patient"

  useEffect(() => {
    if (trimmed.length > 0) setIsOpen(true);
  }, [trimmed]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const selectPatient = (patientId: number) => {
    setQuery('');
    setIsOpen(false);
    onSelectPatient(patientId);
  };

  const registerNew = () => {
    setQuery('');
    setIsOpen(false);
    navigate(`${ROUTES.PATIENTS}?new=1`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || trimmed.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalOptions);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      if (activeIndex < results.length) {
        selectPatient(results[activeIndex].patientId);
      } else {
        registerNew();
      }
    }
  };

  const showPanel = isOpen && trimmed.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (trimmed.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onClear={() => {
          setQuery('');
          setIsOpen(false);
        }}
        placeholder="Search patient by name, NIC or phone"
        aria-label="Search patient"
        autoComplete="off"
      />

      {showPanel && (
        <div
          role="listbox"
          aria-label="Patient search results"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-popover animate-scale-in"
        >
          {search.error ? (
            <div className="p-3">
              <ErrorBanner message={search.error} onRetry={search.reload} />
            </div>
          ) : search.isLoading && results.length === 0 ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton width={32} height={32} rounded="full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton height={12} width="55%" />
                    <Skeleton height={10} width="35%" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-on-surface-variant">
              No patient found
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((patient, index) => (
                <li key={patient.patientId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => selectPatient(patient.patientId)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      index === activeIndex
                        ? 'bg-primary-container/50'
                        : 'hover:bg-surface-container-high',
                    )}
                  >
                    <Avatar
                      name={formatFullName(patient.firstName, patient.lastName)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body-sm font-medium text-on-surface">
                        {formatFullName(patient.firstName, patient.lastName)}
                      </div>
                      <div className="truncate text-label-md text-on-surface-variant">
                        {patient.nicPassportNo}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!search.error && trimmed.length > 0 && (
            <button
              type="button"
              onClick={registerNew}
              onMouseEnter={() => setActiveIndex(results.length)}
              className={cn(
                'flex w-full items-center gap-3 border-t border-outline-variant px-3 py-2.5 text-left text-body-sm font-medium text-primary transition-colors',
                activeIndex === results.length
                  ? 'bg-primary-container/50'
                  : 'hover:bg-surface-container-high',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <Icon name="person_add" size={18} />
              </span>
              Register new patient
            </button>
          )}
        </div>
      )}
    </div>
  );
}
