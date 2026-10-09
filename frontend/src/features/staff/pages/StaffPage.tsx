import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/common/Pagination';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { fetchBranches } from '../../../services/api/branches';
import { fetchStaff } from '../../../services/api/staff';
import type { Branch, Staff } from '../../../types';
import { formatDate, formatFullName, getInitials } from '../../../utils/formatters';
import { EMPLOYMENT_STATUS_TONE } from '../statusStyles';

const PAGE_SIZE = 10;

const ALL_JOB_TITLE_OPTION = { label: 'All Job Titles', value: 'all' };

export function StaffPage() {
  const [query, setQuery] = useState('');
  const [jobTitle, setJobTitle] = useState('all');
  const [page, setPage] = useState(1);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobTitleOptions, setJobTitleOptions] = useState<Array<{ label: string; value: string }>>([
    ALL_JOB_TITLE_OPTION,
  ]);
  const [branchOptions, setBranchOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchStaff({
          page,
          pageSize: PAGE_SIZE,
          search: query.trim() || undefined,
          jobTitle: jobTitle === 'all' ? undefined : jobTitle,
        });

        if (cancelled) return;

        setStaff(response.items);
        setTotalItems(response.total);

        const titles = Array.from(
          new Set(
            response.items
              .map((member) => member.jobTitle)
              .filter((value): value is string => Boolean(value && value.trim())),
          ),
        ).sort((left, right) => left.localeCompare(right));

        setJobTitleOptions([
          ALL_JOB_TITLE_OPTION,
          ...titles.map((title) => ({ label: title, value: title })),
        ]);
      } catch {
        if (!cancelled) {
          setStaff([]);
          setTotalItems(0);
          setError('Unable to load staff data right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStaff();
    return () => {
      cancelled = true;
    };
  }, [jobTitle, page, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      try {
        const result = await fetchBranches();
        if (cancelled) return;

        const options = result.items.map((branch: Branch) => ({
          label: branch.branchName,
          value: String(branch.branchId),
        }));

        setBranchOptions(options);
      } catch {
        if (!cancelled) {
          setBranchOptions([]);
        }
      }
    }

    loadBranches();
    return () => {
      cancelled = true;
    };
  }, []);

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
            options={jobTitleOptions}
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
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    Loading staff...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-error">
                    {error}
                  </td>
                </tr>
              ) : staff.length > 0 ? (
                staff.map((member) => {
                  const fullName = formatFullName(member.firstName, member.lastName);
                  return (
                    <tr key={member.staffId} className="hover:bg-surface-container-high transition-colors h-10">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(fullName)}
                          </div>
                          <div>
                            <div className="font-medium">{fullName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-on-surface-variant">{member.jobTitle}</td>
                      <td className="py-1.5 px-3 text-on-surface-variant">
                        <span className="text-outline italic">No login</span>
                      </td>
                      <td className="py-1.5 px-3 text-on-surface-variant">{member.branchName}</td>
                      <td className="py-1.5 px-3 text-on-surface-variant">
                        {member.phones?.[0]?.phoneNumber ?? '—'}
                      </td>
                      <td className="py-1.5 px-3 text-on-surface-variant">
                        {formatDate(member.hireDate)}
                      </td>
                      <td className="py-1.5 px-3">
                        <Badge tone={EMPLOYMENT_STATUS_TONE[member.employmentStatus]}>
                          {member.employmentStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
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
          totalItems={totalItems}
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
            <Select
              label="Branch"
              placeholder="Select branch"
              options={branchOptions}
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
            />
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
