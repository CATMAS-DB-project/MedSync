import { useEffect, useRef, useState } from 'react';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchPatientById, fetchPatients } from '../../../services/api/patients';
import { calculateAge, formatFullName } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import { PatientFormModal } from '../../patients/components/PatientFormModal';
import type { Patient } from '../../../types';

export interface PatientPickerProps {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  disabled?: boolean;
  /** Optional id to preselect on first render; the picker fetches it. */
  initialPatientId?: number | null;
}

export function PatientPicker({
  value,
  onChange,
  disabled = false,
  initialPatientId = null,
}: PatientPickerProps) {
  const { currentUser } = useAuth();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const toast = useToast();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const preloadRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matches = useAsync(
    () => {
      const trimmed = debouncedQuery.trim();
      if (trimmed.length === 0 || value !== null) return Promise.resolve(null);
      return fetchPatients({ search: trimmed, pageSize: 6 });
    },
    [debouncedQuery, value?.patientId ?? null],
  );

  useEffect(() => {
    if (initialPatientId === null) return;
    if (value !== null) return;
    if (preloadRef.current === initialPatientId) return;
    preloadRef.current = initialPatientId;
    setIsPreloading(true);
    fetchPatientById(initialPatientId)
      .then((patient) => onChange(patient))
      .catch(() => toast.error('Could not load the selected patient'))
      .finally(() => setIsPreloading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId]);

  const clearSelection = () => {
    onChange(null);
    setQuery('');
  };

  const handleCreateSaved = (patientId: number, mode: 'create' | 'edit') => {
    setIsFormOpen(false);
    if (mode !== 'create') return;
    fetchPatientById(patientId)
      .then((patient) => {
        onChange(patient);
        toast.success('Patient registered');
      })
      .catch(() => toast.error('Patient registered, but could not be loaded'));
  };

  const handleViewExisting = (patientId: number) => {
    setIsFormOpen(false);
    fetchPatientById(patientId)
      .then((patient) => onChange(patient))
      .catch(() => toast.error('Could not load the existing patient'));
  };

  if (isPreloading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4">
        <Skeleton width={40} height={40} rounded="full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton height={12} width="55%" />
          <Skeleton height={10} width="30%" />
        </div>
      </div>
    );
  }

  if (value) {
    const age = calculateAge(value.dateOfBirth);
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4">
        <Avatar name={formatFullName(value.firstName, value.lastName)} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-md font-semibold text-on-surface">
            {formatFullName(value.firstName, value.lastName)}
          </div>
          <div className="truncate text-label-md text-on-surface-variant">
            {value.nicPassportNo}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral" pill>
              {age ?? '—'} yrs
            </Badge>
            <Badge tone="info" pill>
              {value.gender}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          disabled={disabled}
        >
          Change
        </Button>
      </div>
    );
  }

  const results = matches.data?.items ?? [];
  const showResults =
    isDropdownOpen && debouncedQuery.trim().length > 0 && matches.data !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" ref={searchContainerRef}>
        <SearchInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onClear={() => {
            setQuery('');
            setIsDropdownOpen(false);
          }}
          placeholder="Search by name, NIC or phone"
          aria-label="Search patients"
          disabled={disabled}
          autoComplete="off"
        />

        {showResults && (
          <div
            role="listbox"
            aria-label="Patient search results"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-popover animate-scale-in"
          >
            {matches.error ? (
              <div className="p-3">
                <ErrorBanner message={matches.error} onRetry={matches.reload} />
              </div>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-body-sm text-on-surface-variant">
                No patient found
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((patient) => (
                  <li key={patient.patientId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        onChange(patient);
                        setQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high focus-visible:bg-surface-container-high focus-visible:outline-none"
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
          </div>
        )}
      </div>

      {isReceptionist && (
        <Button
          variant="secondary"
          size="sm"
          icon="person_add"
          onClick={() => setIsFormOpen(true)}
          disabled={disabled}
          className={cn('self-start')}
        >
          Register new patient
        </Button>
      )}

      {isReceptionist && (
        <PatientFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          patientId={null}
          onSaved={handleCreateSaved}
          onViewExisting={handleViewExisting}
        />
      )}
    </div>
  );
}
