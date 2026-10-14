import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Toggle } from '../../../components/ui/Toggle';
import { Pagination } from '../../../components/common/Pagination';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { useAuth } from '../../../context/AuthContext';
import { useBranchNames } from '../../../hooks/useBranchNames';
import { ApiError } from '../../../services/api/ApiError';
import { createUserAccount } from '../../../services/api/accounts';
import { fetchDoctors, promoteStaffToDoctor } from '../../../services/api/doctor';
import type { DoctorOption } from '../../../services/api/doctorOptions';
import { createStaff, fetchStaff } from '../../../services/api/staff';
import { addStaffPhone } from '../../../services/api/staffPhones';
import type { Gender, PhoneType, Role, Staff } from '../../../types';
import { todayIso } from '../../../utils/dates';
import { formatDate, formatFullName, getInitials } from '../../../utils/formatters';
import { StaffDetailsDrawer } from '../components/StaffDetailsDrawer';

const PAGE_SIZE = 100;

const ALL_JOB_TITLE_OPTION = { label: 'All Job Titles', value: 'all' };

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

const PHONE_TYPE_OPTIONS = [
  { label: 'Mobile', value: 'Mobile' },
  { label: 'Home', value: 'Home' },
  { label: 'Work', value: 'Work' },
];

const JOB_TITLE_OPTIONS = [
  'Doctor',
  'Receptionist',
  'Branch Manager',
  'QA Tester',
  'Admin',
  'Nurse',
  'Medical Assistant',
  'Lab Technician',
  'Pharmacist',
  'Medical Billing Specialist',
].map((title) => ({ label: title, value: title }));

const BRANCH_MANAGER_JOB_TITLE_OPTIONS = JOB_TITLE_OPTIONS.filter(
  ({ value }) => value !== 'Admin' && value !== 'Branch Manager',
);

const ROLE_OPTIONS: Array<{ label: string; value: Role }> = [
  { label: 'Receptionist', value: 'Receptionist' },
  { label: 'Doctor', value: 'Doctor' },
  { label: 'Branch Manager', value: 'Branch Manager' },
  { label: 'QA Tester', value: 'QA Tester' },
  { label: 'Admin', value: 'Admin' },
];

interface NewStaffFormState {
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  address: string;
  jobTitle: string;
  branchId: string;
  hireDate: string;
  phoneNumber: string;
  phoneType: PhoneType;
  isDoctor: boolean;
  licenseNo: string;
  yearsOfExperience: string;
  consultationFee: string;
  qualifications: string;
  createAccount: boolean;
  username: string;
  password: string;
  accountRole: Role;
}

type NewStaffFieldErrors = Partial<
  Record<
    | 'nic'
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'gender'
    | 'jobTitle'
    | 'branchId'
    | 'hireDate'
    | 'licenseNo'
    | 'yearsOfExperience'
    | 'consultationFee'
    | 'username'
    | 'password'
    | 'accountRole',
    string
  >
>;

function createEmptyStaffForm(defaultBranchId?: number): NewStaffFormState {
  return {
    nic: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    jobTitle: '',
    branchId: defaultBranchId ? String(defaultBranchId) : '',
    hireDate: todayIso(),
    phoneNumber: '',
    phoneType: 'Mobile',
    isDoctor: false,
    licenseNo: '',
    yearsOfExperience: '0',
    consultationFee: '0',
    qualifications: '',
    createAccount: false,
    username: '',
    password: '',
    accountRole: 'Receptionist',
  };
}

export function StaffPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const isAdmin = currentUser?.role === 'Admin';
  const isBranchManager = currentUser?.role === 'Branch Manager';

  const [query, setQuery] = useState('');
  const [jobTitle, setJobTitle] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [doctorsByStaffId, setDoctorsByStaffId] = useState<Record<number, DoctorOption>>({});
  const [selectedStaffTarget, setSelectedStaffTarget] = useState<Staff | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobTitleOptions, setJobTitleOptions] = useState<Array<{ label: string; value: string }>>([
    ALL_JOB_TITLE_OPTION,
  ]);
  const {
    branches,
    error: branchesError,
    reload: reloadBranches,
  } = useBranchNames();
  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        label: branch.branchName,
        value: String(branch.branchId),
      })),
    [branches],
  );

  const [form, setForm] = useState<NewStaffFormState>(() =>
    createEmptyStaffForm(currentUser?.branchId),
  );
  const [fieldErrors, setFieldErrors] = useState<NewStaffFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddDrawer = useCallback(() => {
    setQuery('');
    setJobTitle('all');
    setPage(1);
    setForm(
      createEmptyStaffForm(isBranchManager ? currentUser?.branchId : undefined),
    );
    setFieldErrors({});
    setSubmitError(null);
    setDrawerOpen(true);
  }, [currentUser?.branchId, isBranchManager]);

  const closeAddDrawer = useCallback(() => {
    if (isSubmitting) return;
    setDrawerOpen(false);
  }, [isSubmitting]);

  const setField = <K extends keyof NewStaffFormState>(
    key: K,
    value: NewStaffFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateStaff = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    const errors: NewStaffFieldErrors = {};
    const today = todayIso();
    if (!form.nic.trim()) errors.nic = 'NIC is required';
    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';
    if (!form.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else if (form.dateOfBirth > today) {
      errors.dateOfBirth = 'Date of birth cannot be in the future';
    }
    if (!form.gender) errors.gender = 'Select a gender';
    if (!form.jobTitle.trim()) errors.jobTitle = 'Job title is required';
    if (!form.branchId) errors.branchId = 'Select a branch';
    if (!form.hireDate) {
      errors.hireDate = 'Hire date is required';
    } else if (form.hireDate > today) {
      errors.hireDate = 'Hire date cannot be in the future';
    }

    const exp = Number(form.yearsOfExperience);
    const fee = Number(form.consultationFee);
    const isDoctorRegistration = form.jobTitle === 'Doctor' && form.isDoctor;
    if (form.isDoctor && form.jobTitle !== 'Doctor') {
      errors.jobTitle = 'Select the Doctor job title to add doctor credentials';
    }
    if (isDoctorRegistration) {
      if (!form.licenseNo.trim()) {
        errors.licenseNo = 'License number is required';
      }
      if (
        form.yearsOfExperience.trim() === '' ||
        Number.isNaN(exp) ||
        exp < 0 ||
        !Number.isInteger(exp)
      ) {
        errors.yearsOfExperience = 'Enter a valid whole number (0 or more)';
      }
      if (form.consultationFee.trim() === '' || Number.isNaN(fee) || fee < 0) {
        errors.consultationFee = 'Enter a valid consultation fee (0 or more)';
      }
    }

    if (isAdmin && form.createAccount) {
      if (form.username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters';
      }
      if (form.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
      if (form.accountRole === 'Doctor' && !isDoctorRegistration) {
        errors.accountRole =
          'Mark this staff member as a doctor before assigning the Doctor system role';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created = await createStaff({
        nic: form.nic.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as Gender,
        address: form.address.trim() || undefined,
        branchId: Number(form.branchId),
        jobTitle: form.jobTitle.trim(),
        employmentStatus: 'Active',
        hireDate: form.hireDate,
      });

      const trimmedPhone = form.phoneNumber.trim();
      if (trimmedPhone) {
        try {
          await addStaffPhone(created.staffId, {
            phoneNumber: trimmedPhone,
            phoneType: form.phoneType,
          });
        } catch (phoneErr) {
          const msg =
            phoneErr instanceof ApiError ? phoneErr.message : 'Could not save phone number';
          toast.error(`Staff created, but phone was not saved: ${msg}`);
        }
      }

      if (isDoctorRegistration) {
        try {
          await promoteStaffToDoctor(created.staffId, {
            licenseNo: form.licenseNo.trim(),
            yearsOfExperience: exp,
            consultationFee: fee,
            qualifications: form.qualifications.trim() || undefined,
          });
        } catch (docErr) {
          const msg =
            docErr instanceof ApiError ? docErr.message : 'Could not create doctor profile';
          toast.error(`Staff created, but doctor profile creation failed: ${msg}`);
        }
      }

      if (isAdmin && form.createAccount) {
        try {
          await createUserAccount(created.staffId, {
            username: form.username.trim().toLowerCase(),
            tempPassword: form.password,
            role: form.accountRole,
          });
        } catch (accErr) {
          const msg =
            accErr instanceof ApiError ? accErr.message : 'Could not create system account';
          toast.error(`Staff created, but account creation failed: ${msg}`);
        }
      }

      toast.success(isDoctorRegistration ? 'Doctor registered' : 'Staff member added');
      setQuery('');
      setJobTitle('all');
      setPage(1);
      setDrawerOpen(false);
      setReloadCount((c) => c + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Unable to create staff member. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setIsLoading(true);
      setError(null);

      try {
        const [response, doctorList] = await Promise.all([
          fetchStaff({
            page,
            pageSize: PAGE_SIZE,
            search: query.trim() || undefined,
            jobTitle: jobTitle === 'all' ? undefined : jobTitle,
          }),
          fetchDoctors().catch((err) => {
            if (!cancelled) {
              toast.error(
                err instanceof ApiError
                  ? err.message
                  : 'Unable to load doctor profiles.',
              );
            }
            return [] as DoctorOption[];
          }),
        ]);

        if (cancelled) return;

        setStaff(response.items);
        setTotalItems(response.total);

        const docMap: Record<number, DoctorOption> = {};
        for (const doc of doctorList) {
          docMap[doc.staffId] = doc;
        }
        setDoctorsByStaffId(docMap);

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
  }, [jobTitle, page, query, reloadCount, toast]);

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
          onClick={openAddDrawer}
          className="relative z-10 w-full bg-white text-primary shadow-lg hover:bg-secondary hover:text-on-secondary sm:w-auto"
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
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-outline-variant bg-primary-fixed/30">
              <tr>
                <th scope="col" className="w-1/3 px-5 py-3 text-label-md font-semibold text-on-surface-variant">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Job Title
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">
                  Hired
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant text-table-data text-on-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-primary" aria-hidden="true">progress_activity</span>
                      Loading staff details…
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-error" role="alert">
                    {error}
                  </td>
                </tr>
              ) : staff.length > 0 ? (
                staff.map((member) => {
                  const fullName = formatFullName(member.firstName, member.lastName);

                  return (
                    <tr
                      key={member.staffId}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedStaffTarget(member)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedStaffTarget(member);
                        }
                      }}
                      className="group h-16 cursor-pointer odd:bg-surface-container-lowest even:bg-secondary-fixed/10 transition-colors hover:bg-primary-fixed/25 focus-visible:bg-primary-fixed/25 focus-visible:outline-none"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-label-md font-semibold text-primary">
                            {getInitials(fullName)}
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface">{fullName}</div>
                            <div className="text-xs text-on-surface-variant">{member.nic}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.jobTitle}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.branchName}</td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatDate(member.hireDate)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-on-surface-variant">
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
        onClose={closeAddDrawer}
        title="Add New Staff"
        subtitle="Enter details to register personnel."
        footer={
          <>
            <Button variant="secondary" onClick={closeAddDrawer} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateStaff}
              isLoading={isSubmitting}
            >
              Save Staff
            </Button>
          </>
        }
      >
        {submitError && <ErrorBanner message={submitError} />}
        {branchesError && (
          <ErrorBanner message={branchesError} onRetry={reloadBranches} />
        )}

        <DrawerSection title="Personal Information" icon="badge">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="National Identity Card (NIC)"
                placeholder="e.g. 199012345678"
                maxLength={20}
                value={form.nic}
                onChange={(event) => setField('nic', event.target.value)}
                error={fieldErrors.nic}
              />
            </div>
            <Input
              label="First Name"
              placeholder="Given name"
              value={form.firstName}
              onChange={(event) => setField('firstName', event.target.value)}
              error={fieldErrors.firstName}
            />
            <Input
              label="Last Name"
              placeholder="Family name"
              value={form.lastName}
              onChange={(event) => setField('lastName', event.target.value)}
              error={fieldErrors.lastName}
            />
            <Input
              label="Date of Birth"
              type="date"
              max={todayIso()}
              value={form.dateOfBirth}
              onChange={(event) => setField('dateOfBirth', event.target.value)}
              error={fieldErrors.dateOfBirth}
            />
            <Select
              label="Gender"
              placeholder="Select gender"
              options={GENDER_OPTIONS}
              value={form.gender}
              onChange={(event) => setField('gender', event.target.value as Gender | '')}
              error={fieldErrors.gender}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                placeholder="Residential address (optional)"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Employment Details" icon="work">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Job Title"
              placeholder="Select job title"
              options={isBranchManager ? BRANCH_MANAGER_JOB_TITLE_OPTIONS : JOB_TITLE_OPTIONS}
              value={form.jobTitle}
              onChange={(event) => {
                const jobTitle = event.target.value;
                setForm((prev) => ({
                  ...prev,
                  jobTitle,
                  isDoctor: jobTitle === 'Doctor' ? prev.isDoctor : false,
                  accountRole:
                    jobTitle !== 'Doctor' && prev.accountRole === 'Doctor'
                      ? 'Receptionist'
                      : prev.accountRole,
                  licenseNo: jobTitle === 'Doctor' ? prev.licenseNo : '',
                  yearsOfExperience: jobTitle === 'Doctor' ? prev.yearsOfExperience : '0',
                  consultationFee: jobTitle === 'Doctor' ? prev.consultationFee : '0',
                  qualifications: jobTitle === 'Doctor' ? prev.qualifications : '',
                }));
              }}
              error={fieldErrors.jobTitle}
            />
            <Select
              label="Branch"
              placeholder="Select branch"
              options={branchOptions}
              value={form.branchId}
              onChange={(event) => setField('branchId', event.target.value)}
              error={fieldErrors.branchId}
              disabled={isBranchManager}
            />
            <Input
              label="Hire Date"
              type="date"
              max={todayIso()}
              value={form.hireDate}
              onChange={(event) => setField('hireDate', event.target.value)}
              error={fieldErrors.hireDate}
            />
          </div>
        </DrawerSection>

        <DrawerSection title="Contact Information" icon="call">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              placeholder="077-123-4567 (optional)"
              value={form.phoneNumber}
              onChange={(event) => setField('phoneNumber', event.target.value)}
            />
            <Select
              label="Phone Type"
              options={PHONE_TYPE_OPTIONS}
              value={form.phoneType}
              onChange={(event) => setField('phoneType', event.target.value as PhoneType)}
            />
          </div>
        </DrawerSection>

        {isAdmin && (
          <DrawerSection
            title={form.jobTitle === 'Doctor' ? 'Doctor & System Account Access' : 'System Account Access'}
            icon="manage_accounts"
          >
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              {form.jobTitle === 'Doctor' && (
                <>
                  <Toggle
                    checked={form.isDoctor}
                    onChange={(checked) => {
                      setForm((prev) => ({
                        ...prev,
                        isDoctor: checked,
                        accountRole: checked
                          ? 'Doctor'
                          : prev.accountRole === 'Doctor'
                            ? 'Receptionist'
                            : prev.accountRole,
                      }));
                    }}
                    label="Is a doctor?"
                    description="Enable to add this staff member's medical credentials and doctor profile."
                  />
                  {form.isDoctor && (
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-outline-variant pt-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Input
                          label="Medical License Number"
                          placeholder="e.g. SLMC-45821"
                          maxLength={50}
                          value={form.licenseNo}
                          onChange={(event) => setField('licenseNo', event.target.value)}
                          error={fieldErrors.licenseNo}
                        />
                      </div>
                      <Input
                        label="Years of Experience"
                        type="number"
                        min={0}
                        step={1}
                        value={form.yearsOfExperience}
                        onChange={(event) => setField('yearsOfExperience', event.target.value)}
                        error={fieldErrors.yearsOfExperience}
                      />
                      <Input
                        label="Consultation Fee (LKR)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.consultationFee}
                        onChange={(event) => setField('consultationFee', event.target.value)}
                        error={fieldErrors.consultationFee}
                      />
                      <div className="sm:col-span-2">
                        <Input
                          label="Qualifications"
                          placeholder="e.g. MBBS, MD (optional)"
                          value={form.qualifications}
                          onChange={(event) => setField('qualifications', event.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="my-4 border-t border-outline-variant" />
                </>
              )}
              <Toggle
                checked={form.createAccount}
                onChange={(checked) => setField('createAccount', checked)}
                label="Create System Account"
                description="Optional for any staff job title. Create login access and choose the system role that controls app permissions."
              />
              {form.createAccount && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-outline-variant pt-4 sm:grid-cols-2">
                  <Input
                    label="Username"
                    placeholder="e.g. nimal.perera"
                    maxLength={50}
                    value={form.username}
                    onChange={(event) => setField('username', event.target.value)}
                    error={fieldErrors.username}
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="At least 6 characters"
                    maxLength={72}
                    value={form.password}
                    onChange={(event) => setField('password', event.target.value)}
                    error={fieldErrors.password}
                  />
                  <div className="sm:col-span-2">
                    <Select
                      label="System Role (5 Roles)"
                      options={ROLE_OPTIONS}
                      value={form.accountRole}
                      onChange={(event) => setField('accountRole', event.target.value as Role)}
                      error={fieldErrors.accountRole}
                      hint={
                        form.accountRole === 'Doctor' && !form.isDoctor
                          ? 'Mark this staff member as a doctor above before assigning the Doctor system role.'
                          : undefined
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </DrawerSection>
        )}
      </Drawer>

      <StaffDetailsDrawer
        staff={selectedStaffTarget}
        isAlreadyDoctor={
          selectedStaffTarget !== null &&
          Boolean(doctorsByStaffId[selectedStaffTarget.staffId])
        }
        onClose={() => setSelectedStaffTarget(null)}
        onSaved={() => setReloadCount((c) => c + 1)}
      />
    </div>
  );
}
