import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import type { SelectOption } from '../../../components/ui/Select';
import { IconButton } from '../../../components/ui/IconButton';
import { DropdownMenu } from '../../../components/ui/DropdownMenu';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { DataTable } from '../../../components/ui/DataTable';
import type { DataTableColumn } from '../../../components/ui/DataTable';
import { Pagination } from '../../../components/common/Pagination';
import { EmptyState } from '../../../components/common/EmptyState';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useBranchNames } from '../../../hooks/useBranchNames';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchPatients } from '../../../services/api/patients';
import {
  calculateAge,
  formatDate,
  formatFullName,
} from '../../../utils/formatters';
import { PatientDetailDrawer } from '../components/PatientDetailDrawer';
import { PatientFormModal } from '../components/PatientFormModal';
import type { Patient } from '../../../types';

const PAGE_SIZE = 10;

export function PatientsPage() {
  const { currentUser } = useAuth();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const isAdmin = currentUser?.role === 'Admin';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { branches: branchItems, error: branchError, getBranchName } = useBranchNames();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);

  const effectiveBranchId =
    selectedBranchId === null
      ? isAdmin
        ? undefined
        : currentUser?.branchId
      : selectedBranchId === 'all'
        ? undefined
        : selectedBranchId;
  const branchSelectValue =
    selectedBranchId === null
      ? isAdmin
        ? 'all'
        : currentUser
          ? String(currentUser.branchId)
          : ''
      : String(selectedBranchId);
  const branchOptions: SelectOption[] = useMemo(
    () => [
      { label: 'All branches', value: 'all' },
      ...branchItems.map((branch) => ({
        label: branch.branchName,
        value: String(branch.branchId),
      })),
    ],
    [branchItems],
  );

  const patients = useAsync(
    () =>
      fetchPatients({
        search: debouncedQuery || undefined,
        branchId: effectiveBranchId,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedQuery, effectiveBranchId, page],
  );

  const rows = patients.data?.items ?? [];
  const total = patients.data?.total ?? 0;
  const isFirstLoad = patients.isLoading && patients.data === undefined;

  // ?new=1 → open registration modal for Receptionists, then strip the param.
  const newParam = searchParams.get('new');
  useEffect(() => {
    if (newParam !== '1') return;
    if (!isReceptionist) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
      return;
    }
    setEditingPatientId(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [newParam, isReceptionist, searchParams, setSearchParams]);

  const openCreate = useCallback(() => {
    setEditingPatientId(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((patientId: number) => {
    setEditingPatientId(patientId);
    setFormOpen(true);
  }, []);

  const handleSaved = useCallback(
    (patientId: number, mode: 'create' | 'edit') => {
      setFormOpen(false);
      setEditingPatientId(null);
      patients.reload();
      if (mode === 'create') {
        setSelectedPatientId(patientId);
        toast.success('Patient registered');
      } else {
        toast.success('Patient updated');
      }
    },
    [patients, toast],
  );

  const handleViewExisting = useCallback((patientId: number) => {
    setFormOpen(false);
    setEditingPatientId(null);
    setSelectedPatientId(patientId);
  }, []);

  const columns: DataTableColumn<Patient>[] = [
    {
      key: 'patient',
      header: 'Patient',
      primary: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={formatFullName(row.firstName, row.lastName)} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-body-md font-semibold text-on-surface">
              {formatFullName(row.firstName, row.lastName)}
            </div>
            <div className="truncate text-label-md text-on-surface-variant">
              {row.nicPassportNo}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'ageGender',
      header: 'Age · Gender',
      secondary: true,
      cell: (row) => {
        const age = calculateAge(row.dateOfBirth);
        return `${age ?? '—'} · ${row.gender}`;
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => row.phones?.[0]?.phoneNumber ?? '—',
    },
    {
      key: 'registered',
      header: 'Registered',
      hideOnMobile: true,
      cell: (row) => formatDate(row.createdAt),
    },
    {
      key: 'branch',
      header: 'Branch',
      hideOnMobile: true,
      cell: (row) => {
        const branchName =
          row.registeredBranchName ?? getBranchName(row.registeredBranchId);
        return branchName ? (
          <Badge tone="primary" pill>
            {branchName}
          </Badge>
        ) : (
          <span className="text-on-surface-variant">—</span>
        );
      },
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageHeader
        title="Patients"
        actions={
          isReceptionist ? (
            <Button variant="primary" icon="person_add" onClick={openCreate}>
              Register patient
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            onClear={() => {
              setQuery('');
              setPage(1);
            }}
            placeholder="Search by name, NIC or phone"
            aria-label="Search patients"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            aria-label="Filter patients by branch"
            value={branchSelectValue}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedBranchId(value === 'all' ? 'all' : Number(value));
              setPage(1);
            }}
            options={branchOptions}
            error={branchError ?? undefined}
          />
        </div>
      </div>

      <div
        className={
          patients.isLoading && patients.data !== undefined
            ? 'opacity-60 transition-opacity'
            : 'transition-opacity'
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.patientId)}
          onRowClick={(row) => setSelectedPatientId(row.patientId)}
          loading={isFirstLoad}
          error={patients.error}
          onRetry={patients.reload}
          skeletonRows={PAGE_SIZE}
          emptyState={
            query ? (
              <EmptyState
                icon="group_off"
                title="No patients found"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState icon="group_off" title="No patients found" />
            )
          }
          rowActions={
            isReceptionist
              ? (row) => (
                  <DropdownMenu
                    ariaLabel="Patient actions"
                    trigger={
                      <IconButton icon="more_horiz" size="sm" aria-label="Actions" />
                    }
                    items={[
                      {
                        id: 'view',
                        label: 'View details',
                        icon: 'visibility',
                        onSelect: () => setSelectedPatientId(row.patientId),
                      },
                      {
                        id: 'edit',
                        label: 'Edit',
                        icon: 'edit',
                        onSelect: () => openEdit(row.patientId),
                      },
                    ]}
                  />
                )
              : (row) => (
                  <DropdownMenu
                    ariaLabel="Patient actions"
                    trigger={
                      <IconButton icon="more_horiz" size="sm" aria-label="Actions" />
                    }
                    items={[
                      {
                        id: 'view',
                        label: 'View details',
                        icon: 'visibility',
                        onSelect: () => setSelectedPatientId(row.patientId),
                      },
                    ]}
                  />
                )
          }
          pagination={
            total > 0 ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalItems={total}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />
      </div>

      <PatientDetailDrawer
        patientId={selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
        onChanged={() => patients.reload()}
      />

      {isReceptionist && (
        <PatientFormModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingPatientId(null);
          }}
          patientId={editingPatientId}
          onSaved={handleSaved}
          onViewExisting={handleViewExisting}
        />
      )}
    </div>
  );
}
