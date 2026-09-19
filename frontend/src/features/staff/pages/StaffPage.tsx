import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { mockStaff } from '../../../services/mock/staff';
import { formatDate, formatFullName, getInitials } from '../../../utils/formatters';
import { EMPLOYMENT_STATUS_TONE } from '../statusStyles';

const PAGE_SIZE = 10;

const JOB_TITLE_OPTIONS = [
  { label: 'All Job Titles', value: 'all' },
  { label: 'Physician', value: 'Physician' },
  { label: 'Nurse', value: 'Nurse' },
  { label: 'Receptionist', value: 'Receptionist' },
  { label: 'Administrator', value: 'Administrator' },
];

const BRANCH_OPTIONS = [
  { label: 'Main Branch', value: 'Main Branch' },
  { label: 'Kandy Clinic', value: 'Kandy Clinic' },
  { label: 'Galle Center', value: 'Galle Center' },
];

export function StaffPage() {
  const [query, setQuery] = useState('');
  const [jobTitle, setJobTitle] = useState('all');
  const [page, setPage] = useState(1);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return mockStaff.filter((staff) => {
      const fullName = formatFullName(staff.firstName, staff.lastName);
      const matchesQuery = query.trim() === '' || fullName.toLowerCase().includes(query.toLowerCase());
      const matchesJobTitle = jobTitle === 'all' || staff.jobTitle === jobTitle;
      return matchesQuery && matchesJobTitle;
    });
  }, [query, jobTitle]);

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
            options={JOB_TITLE_OPTIONS}
            value={jobTitle}
            onChange={(event) => {
              setJobTitle(event.target.value);
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
                  Job Title
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Account Role
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Branch
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Phone
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Hired
                </th>
                <th className="py-2 px-3 text-label-md text-on-surface-variant font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface bg-surface-container-lowest">
              {paginated.map((staff) => {
                const fullName = formatFullName(staff.firstName, staff.lastName);
                const specialtyNames = staff.doctor?.specialties
                  .map((specialty) => specialty.specialtyName)
                  .join(', ');
                return (
                  <tr key={staff.staffId} className="hover:bg-surface-container-high transition-colors h-10">
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">
                          {getInitials(fullName)}
                        </div>
                        <div>
                          <div className="font-medium">{fullName}</div>
                          {specialtyNames && (
                            <div className="text-[11px] text-on-surface-variant">{specialtyNames}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-on-surface-variant">{staff.jobTitle}</td>
                    <td className="py-1.5 px-3 text-on-surface-variant">
                      {staff.userAccount?.role ?? (
                        <span className="text-outline italic">No login</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-on-surface-variant">{staff.branchName}</td>
                    <td className="py-1.5 px-3 text-on-surface-variant">
                      {staff.phones?.[0]?.phoneNumber ?? '—'}
                    </td>
                    <td className="py-1.5 px-3 text-on-surface-variant">
                      {formatDate(staff.hireDate)}
                    </td>
                    <td className="py-1.5 px-3">
                      <Badge tone={EMPLOYMENT_STATUS_TONE[staff.employmentStatus]}>
                        {staff.employmentStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
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
            <Input label="First Name" placeholder="Given name" />
            <Input label="Last Name" placeholder="Family name" />
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
            <Input label="Job Title" placeholder="e.g. Physician, Receptionist" />
            <Select label="Branch" placeholder="Select branch" options={BRANCH_OPTIONS} />
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
