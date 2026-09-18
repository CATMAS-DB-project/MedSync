import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { mockPatients } from '../../../services/mock/patients';
import { calculateAge } from '../../../utils/formatters';
import { PATIENT_STATUS_TONE } from '../statusStyles';
import { PatientDetailDrawer } from '../components/PatientDetailDrawer';
import { PatientRegistrationDrawer } from '../components/PatientRegistrationDrawer';
import type { Patient } from '../../../types';

const PAGE_SIZE = 10;

const BRANCH_OPTIONS = [
  { label: 'All Branches', value: 'all' },
  { label: 'Main Branch', value: 'Main Branch' },
  { label: 'Kandy Clinic', value: 'Kandy Clinic' },
  { label: 'Galle Center', value: 'Galle Center' },
];

export function PatientsPage() {
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isRegistrationOpen, setRegistrationOpen] = useState(false);

  const filteredPatients = useMemo(() => {
    return mockPatients.filter((patient) => {
      const matchesQuery =
        query.trim() === '' ||
        patient.fullName.toLowerCase().includes(query.toLowerCase()) ||
        patient.nic.toLowerCase().includes(query.toLowerCase()) ||
        patient.phone.includes(query);
      const matchesBranch = branch === 'all' || patient.branch === branch;
      return matchesQuery && matchesBranch;
    });
  }, [query, branch]);

  const paginatedPatients = filteredPatients.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Patients</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Search, filter, and manage patient records
          </p>
        </div>
        <Button variant="primary" icon="person_add" onClick={() => setRegistrationOpen(true)}>
          Register New Patient
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search by name, NIC, or phone... (Ctrl+K)"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <Select
            options={BRANCH_OPTIONS}
            value={branch}
            onChange={(event) => {
              setBranch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
          <h3 className="text-headline-sm text-on-surface">Recent Registrations</h3>
          <div className="flex gap-2">
            <button
              type="button"
              title="Export"
              className="p-1 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-1/4">
                  Name
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  NIC / Passport
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Phone
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Branch
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-16 text-center">
                  Age
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Status
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-24 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {paginatedPatients.map((patient) => (
                <tr
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className="hover:bg-surface-container-high cursor-pointer transition-colors h-8 group"
                >
                  <td className="py-1.5 px-3 font-medium">{patient.fullName}</td>
                  <td className="py-1.5 px-3 font-mono text-xs">{patient.nic}</td>
                  <td className="py-1.5 px-3">{patient.phone}</td>
                  <td className="py-1.5 px-3">
                    <Badge tone="primary">{patient.branch}</Badge>
                  </td>
                  <td className="py-1.5 px-3 text-center text-on-surface-variant">
                    {calculateAge(patient.dateOfBirth) ?? '—'}
                  </td>
                  <td className="py-1.5 px-3">
                    <Badge tone={PATIENT_STATUS_TONE[patient.status]}>{patient.status}</Badge>
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPatient(patient);
                      }}
                      className="text-primary hover:text-primary-fixed-variant text-label-md px-2 py-1 border border-transparent hover:border-primary rounded transition-all opacity-0 group-hover:opacity-100"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedPatients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filteredPatients.length}
          onPageChange={setPage}
        />
      </div>

      <PatientDetailDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      <PatientRegistrationDrawer
        isOpen={isRegistrationOpen}
        onClose={() => setRegistrationOpen(false)}
      />
    </div>
  );
}
