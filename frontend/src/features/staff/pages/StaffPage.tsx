import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { mockStaff } from '../../../services/mock/staff';
import { formatDate, getInitials } from '../../../utils/formatters';
import { STAFF_STATUS_TONE } from '../statusStyles';
import type { StaffRole } from '../../../types';

const PAGE_SIZE = 10;

const ROLE_OPTIONS: { label: string; value: StaffRole | 'all' }[] = [
  { label: 'All Roles', value: 'all' },
  { label: 'Doctor', value: 'Doctor' },
  { label: 'Nurse', value: 'Nurse' },
  { label: 'Receptionist', value: 'Receptionist' },
  { label: 'Pharmacist', value: 'Pharmacist' },
  { label: 'Admin', value: 'Admin' },
];

const NEW_STAFF_ROLE_OPTIONS = ROLE_OPTIONS.filter((option) => option.value !== 'all') as {
  label: string;
  value: StaffRole;
}[];

const BRANCH_OPTIONS = [
  { label: 'Central Branch', value: 'Central Branch' },
  { label: 'North Clinic', value: 'North Clinic' },
  { label: 'East Wing', value: 'East Wing' },
];

export function StaffPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<StaffRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return mockStaff.filter((staff) => {
      const matchesQuery =
        query.trim() === '' || staff.fullName.toLowerCase().includes(query.toLowerCase());
      const matchesRole = role === 'all' || staff.role === role;
      return matchesQuery && matchesRole;
    });
  }, [query, role]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-display-sm text-on-surface">Staff Directory</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Manage clinical and administrative personnel
          </p>
        </div>
        <Button variant="primary" icon="person_add" onClick={() => setDrawerOpen(true)}>
          Add New Staff
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search staff by name..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-56">
          <Select
            options={ROLE_OPTIONS}
            value={role}
            onChange={(event) => {
              setRole(event.target.value as StaffRole | 'all');
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col flex-1 overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
              <tr>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold w-1/4">
                  Name
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Role
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Branch
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Phone
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Joined
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {paginated.map((staff) => (
                <tr key={staff.id} className="hover:bg-surface-container-high transition-colors h-10">
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">
                        {getInitials(staff.fullName)}
                      </div>
                      <div>
                        <div className="font-medium">{staff.fullName}</div>
                        {staff.specialty && (
                          <div className="text-[11px] text-on-surface-variant">
                            {staff.specialty}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{staff.role}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{staff.branch}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">{staff.phone}</td>
                  <td className="py-1.5 px-3 text-on-surface-variant">
                    {formatDate(staff.joinedOn)}
                  </td>
                  <td className="py-1.5 px-3">
                    <Badge tone={STAFF_STATUS_TONE[staff.status]}>{staff.status}</Badge>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No staff match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Add New Staff"
        subtitle="Enter details to register personnel."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>
              Save Staff
            </Button>
          </>
        }
      >
        <DrawerSection title="Personal Information" icon="badge">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="National Identity Card (NIC)" placeholder="e.g. 199012345678" />
            </div>
            <div className="sm:col-span-2">
              <Input label="Full Name" placeholder="Legal full name" />
            </div>
            <Input label="Date of Birth" type="date" />
            <Select
              label="Gender"
              placeholder="Select gender"
              options={[
                { label: 'Male', value: 'Male' },
                { label: 'Female', value: 'Female' },
                { label: 'Other', value: 'Other' },
              ]}
            />
          </div>
        </DrawerSection>

        <DrawerSection title="Employment Details" icon="work">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Role" placeholder="Select role" options={NEW_STAFF_ROLE_OPTIONS} />
            <Select label="Branch" placeholder="Select branch" options={BRANCH_OPTIONS} />
            <div className="sm:col-span-2">
              <Input label="Specialty (optional)" placeholder="e.g. Pediatrics" />
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Contact Information" icon="call">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" placeholder="077-123-4567" />
            <Input label="Email" type="email" placeholder="name@catms.lk" />
          </div>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
