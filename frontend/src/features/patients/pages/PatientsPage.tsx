import { useCallback, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { fetchBranches } from '../../../services/api/branches';
import { fetchPatients } from '../../../services/api/patients';
import { calculateAge, formatFullName } from '../../../utils/formatters';
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
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Patients</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Search, filter, and manage patient records
          </p>
        </div>
        {canRegister && (
          <Button variant="primary" icon="person_add" onClick={() => setRegistrationOpen(true)}>
            Register New Patient
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search by name, NIC, or phone..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <Select
            options={branchOptions}
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
          <h3 className="text-headline-sm text-on-surface">Patients</h3>
          {patients.isLoading && (
            <span className="text-body-sm text-on-surface-variant">Loading…</span>
          )}
        </div>

        {patients.error && (
          <div className="px-4 py-3 bg-error/10 text-error text-body-sm flex items-center justify-between">
            <span>{patients.error}</span>
            <button type="button" className="underline" onClick={patients.reload}>
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-1/4">Name</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">NIC / Passport</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Phone</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">Branch</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-16 text-center">Age</th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {rows.map((patient) => (
                <tr
                  key={patient.patientId}
                  onClick={() => setSelectedPatientId(patient.patientId)}
                  className="hover:bg-surface-container-high cursor-pointer transition-colors h-8 group"
                >
                  <td className="py-1.5 px-3 font-medium">
                    {formatFullName(patient.firstName, patient.lastName)}
                  </td>
                  <td className="py-1.5 px-3 font-mono text-xs">{patient.nicPassportNo}</td>
                  <td className="py-1.5 px-3">{patient.phones?.[0]?.phoneNumber ?? '—'}</td>
                  <td className="py-1.5 px-3">
                    <Badge tone="primary">{patient.registeredBranchName ?? '—'}</Badge>
                  </td>
                  <td className="py-1.5 px-3 text-center text-on-surface-variant">
                    {calculateAge(patient.dateOfBirth) ?? '—'}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPatientId(patient.patientId);
                      }}
                      className="text-primary hover:text-primary-fixed-variant text-label-md px-2 py-1 border border-transparent hover:border-primary rounded transition-all opacity-0 group-hover:opacity-100"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!patients.isLoading && !patients.error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
      </div>

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
