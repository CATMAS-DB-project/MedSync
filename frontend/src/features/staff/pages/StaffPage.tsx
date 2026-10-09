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
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated backdrop-blur-sm">
            <span className="material-symbols-outlined text-[26px]" aria-hidden="true">medical_services</span>
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">People &amp; care teams</p>
            <h2 className="text-display-sm text-white">Staff Directory</h2>
            <p className="mt-1 text-body-sm text-white/80">
              Manage clinical and administrative personnel
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          icon="person_add"
          onClick={() => setDrawerOpen(true)}
          className="relative z-10 w-full bg-white text-primary shadow-lg hover:bg-primary-fixed sm:w-auto"
        >
          Add New Staff
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">manage_search</span>
            </span>
            <div>
              <h3 className="text-body-md font-semibold text-on-surface">Find a team member</h3>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Search by name or filter by job title.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Input
              label="Search staff"
              icon="search"
              placeholder="Search staff by name..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label="Job title"
              options={jobTitleOptions}
              value={jobTitle}
              onChange={(event) => {
                setJobTitle(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-headline-sm text-on-surface">Team directory</h3>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-md font-medium text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">groups</span>
              {totalItems.toLocaleString()} {totalItems === 1 ? 'team member' : 'team members'}
            </div>
          </div>
          {isLoading && (
            <span className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant" role="status">
              <span className="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">progress_activity</span>
              Loading staff
            </span>
          )}
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-primary-fixed/30">
              <tr>
                <th scope="col" className="w-1/4 px-5 py-3 text-label-md font-semibold text-on-surface-variant">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Job Title
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Account Role
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Phone
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Hired
                </th>
                <th scope="col" className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-primary" aria-hidden="true">progress_activity</span>
                      Loading staff details…
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-error" role="alert">
                    {error}
                  </td>
                </tr>
              ) : staff.length > 0 ? (
                staff.map((member) => {
                  const fullName = formatFullName(member.firstName, member.lastName);
                  return (
                    <tr key={member.staffId} className="group h-16 odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-label-md font-semibold text-primary">
                            {getInitials(fullName)}
                          </div>
                          <div className="font-semibold text-on-surface">{fullName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.jobTitle}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        <span className="inline-flex rounded-full bg-surface-container-low px-2.5 py-1 text-xs text-outline">
                          No login
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.branchName}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {member.phones?.[0]?.phoneNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatDate(member.hireDate)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={EMPLOYMENT_STATUS_TONE[member.employmentStatus]}>
                          {member.employmentStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                    No staff match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-outline-variant">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        </div>
      </section>

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
