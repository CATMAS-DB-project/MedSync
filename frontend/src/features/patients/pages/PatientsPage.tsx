import { useCallback, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { PageSkeleton } from '../../../components/common/PageSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchBranches } from '../../../services/api/branches';
import { fetchPatients } from '../../../services/api/patients';
import { calculateAge, formatFullName, getInitials } from '../../../utils/formatters';
import { PatientDetailDrawer } from '../components/PatientDetailDrawer';
import { PatientRegistrationDrawer } from '../components/PatientRegistrationDrawer';

const PAGE_SIZE = 10;

export function PatientsPage() {
  const { currentUser } = useAuth();
  const canRegister = currentUser?.role === 'Receptionist';

  const [query, setQuery] = useState('');
  const [branchId, setBranchId] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [isRegistrationOpen, setRegistrationOpen] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 300);

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const patients = useAsync(
    () =>
      fetchPatients({
        search: debouncedQuery,
        branchId: branchId === 'all' ? undefined : Number(branchId),
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedQuery, branchId, page],
  );

  const branchOptions = [
    { label: 'All Branches', value: 'all' },
    ...(branches.data?.items ?? []).map((b) => ({
      label: b.branchName,
      value: String(b.branchId),
    })),
  ];

  const rows = patients.data?.items ?? [];
  const total = patients.data?.total ?? 0;

  const closeDetail = useCallback(() => setSelectedPatientId(null), []);
  const closeRegistration = useCallback(() => setRegistrationOpen(false), []);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated backdrop-blur-sm">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">group</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Patient care</p>
            <h2 className="text-display-sm text-white">Patients</h2>
            <p className="mt-1 text-body-sm text-white/80">
              Search, filter, and manage patient records
            </p>
          </div>
        </div>
        {canRegister && (
          <Button
            variant="primary"
            icon="person_add"
            onClick={() => setRegistrationOpen(true)}
            className="relative z-10 w-full bg-white text-primary shadow-lg hover:bg-secondary hover:text-on-secondary sm:w-auto"
          >
            Register New Patient
          </Button>
        )}
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">manage_search</span>
            </span>
            <div>
              <h3 className="text-body-md font-semibold text-on-surface">Find a patient</h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Search by patient details or narrow results by branch.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Input
              label="Search patients"
              icon="search"
              placeholder="Search by name, NIC, or phone..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Branch"
              options={branchOptions}
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-headline-sm text-on-surface">Patient directory</h3>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-md font-medium text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">groups</span>
              {total.toLocaleString()} {total === 1 ? 'record' : 'records'} found
            </div>
          </div>
          {patients.isLoading && <PageSkeleton className="w-24" />}
        </div>

        {patients.error && (
          <div className="p-4">
            <ErrorBanner message={patients.error} onRetry={patients.reload} />
          </div>
        )}

        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-primary-fixed/30">
              <tr>
                <th scope="col" className="w-[27%] px-5 py-3 text-label-md font-semibold text-on-surface-variant">Patient</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">NIC / Passport</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Phone</th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Branch</th>
                <th scope="col" className="w-20 px-4 py-3 text-center text-label-md font-semibold text-on-surface-variant">Age</th>
                <th scope="col" className="w-24 px-5 py-3 text-right text-label-md font-semibold text-on-surface-variant">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface">
              {patients.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8">
                    <PageSkeleton className="space-y-4" />
                  </td>
                </tr>
              )}

              {!patients.isLoading && !patients.error && rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No patients found"
                      description="Try a different search term or branch filter."
                      icon="search_off"
                    />
                  </td>
                </tr>
              )}

              {rows.map((patient) => (
                <tr
                  key={patient.patientId}
                  onClick={() => setSelectedPatientId(patient.patientId)}
                  className="group h-16 cursor-pointer odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25 focus-within:bg-primary-fixed/25"
                >
                  <td className="px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-label-md font-semibold text-primary">
                        {getInitials(formatFullName(patient.firstName, patient.lastName))}
                      </span>
                      <span className="truncate font-semibold text-on-surface">
                        {formatFullName(patient.firstName, patient.lastName)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                    {patient.nicPassportNo}
                  </td>
                  <td className="px-4 py-3">{patient.phones?.[0]?.phoneNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    {patient.registeredBranchName ? (
                      <Badge tone="primary">{patient.registeredBranchName}</Badge>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-on-surface-variant">
                    {calculateAge(patient.dateOfBirth) ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPatientId(patient.patientId);
                      }}
                      className="rounded-md px-2 py-1 text-label-md font-medium text-primary transition-colors hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-outline-variant">
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
        </div>
      </section>

      <PatientDetailDrawer patientId={selectedPatientId} onClose={closeDetail} />
      {canRegister && (
        <PatientRegistrationDrawer
          isOpen={isRegistrationOpen}
          onClose={closeRegistration}
          onRegistered={() => {
            setPage(1);
            patients.reload();
          }}
          onViewExisting={(patientId) => {
            setRegistrationOpen(false);
            setSelectedPatientId(patientId);
          }}
        />
      )}
    </div>
  );
}
