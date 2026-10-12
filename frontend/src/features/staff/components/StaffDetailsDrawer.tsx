import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../services/api/ApiError';
import {
  createUserAccount,
  resetStaffPassword,
  updateUserAccount,
} from '../../../services/api/accounts';
import {
  fetchDoctorByStaffId,
  linkDoctorSpecialty,
  unlinkDoctorSpecialty,
} from '../../../services/api/doctor';
import { fetchSpecialties } from '../../../services/api/specialties';
import { fetchStaffById } from '../../../services/api/staff';
import type {
  AccountStatus,
  Doctor,
  Role,
  Specialty,
  Staff,
  UserAccount,
} from '../../../types';
import { formatCurrency, formatFullName } from '../../../utils/formatters';

export interface StaffDetailsDrawerProps {
  staff: Staff | null;
  isAlreadyDoctor: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type DrawerTab = 'doctor' | 'account';

const ROLE_OPTIONS: Array<{ label: string; value: Role }> = [
  { label: 'Receptionist', value: 'Receptionist' },
  { label: 'Doctor', value: 'Doctor' },
  { label: 'Branch Manager', value: 'Branch Manager' },
  { label: 'QA Tester', value: 'QA Tester' },
  { label: 'Admin', value: 'Admin' },
];

const ACCOUNT_STATUS_OPTIONS: Array<{ label: string; value: AccountStatus }> = [
  { label: 'Active', value: 'Active' },
  { label: 'Disabled', value: 'Disabled' },
];

interface AccountFormState {
  username: string;
  password: string;
  role: Role;
}

interface AccountFieldErrors {
  username?: string;
  password?: string;
  role?: string;
}

export function StaffDetailsDrawer({
  staff,
  isAlreadyDoctor,
  onClose,
  onSaved,
}: StaffDetailsDrawerProps) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';
  const toast = useToast();
  const isOpen = staff !== null;

  const [activeTab, setActiveTab] = useState<DrawerTab>('doctor');
  const [isDoctor, setIsDoctor] = useState(isAlreadyDoctor);
  const [hasAccount, setHasAccount] = useState(false);

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [specialtiesReloadTick, setSpecialtiesReloadTick] = useState(0);
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [accountProfile, setAccountProfile] = useState<UserAccount | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [accountForm, setAccountForm] = useState<AccountFormState>({
    username: '',
    password: '',
    role: 'Receptionist',
  });
  const [accountErrors, setAccountErrors] = useState<AccountFieldErrors>({});

  const [editRole, setEditRole] = useState<Role>('Receptionist');
  const [editStatus, setEditStatus] = useState<AccountStatus>('Active');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingSpecialtyId, setTogglingSpecialtyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSpecialtiesError(null);
    fetchSpecialties(1, 100)
      .then((res) => {
        if (!cancelled) setSpecialties(res.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setSpecialties([]);
          setSpecialtiesError(
            err instanceof ApiError
              ? err.message
              : 'Unable to load medical specialties.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [specialtiesReloadTick]);

  useEffect(() => {
    if (!staff) return;
    setActiveTab('doctor');
    setIsDoctor(isAlreadyDoctor);
    setHasAccount(false);
    setDoctorProfile(null);
    setAccountProfile(null);
    setAccountErrors({});
    setNewPassword('');
    setNewPasswordError(undefined);
    setSubmitError(null);
    setAccountForm({
      username: '',
      password: '',
      role: isAlreadyDoctor ? 'Doctor' : 'Receptionist',
    });

    let cancelled = false;
    setIsLoadingDetails(true);

    async function loadStaffDetails(staffId: number) {
      try {
        const record = await fetchStaffById(staffId);
        if (cancelled) return;

        const docFlag = record.isDoctor || isAlreadyDoctor;
        setIsDoctor(docFlag);
        setHasAccount(record.hasAccount);
        setAccountForm((prev) => ({
          ...prev,
          role: docFlag ? 'Doctor' : 'Receptionist',
        }));
        if (isAdmin && !docFlag) setActiveTab('account');

        if (docFlag) {
          try {
            const doc = await fetchDoctorByStaffId(staffId);
            if (!cancelled) setDoctorProfile(doc);
          } catch {
            // Ignore if doctor profile fetch fails
          }
        }

        if (isAdmin && record.hasAccount) {
          try {
            const acc = await updateUserAccount(staffId, {});
            if (!cancelled) {
              setAccountProfile(acc);
              setEditRole(acc.role);
              setEditStatus(acc.accountStatus);
            }
          } catch {
            // Non-admin users may not have permission to read user_account row
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSubmitError(
            err instanceof ApiError ? err.message : 'Unable to load staff details.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    }

    loadStaffDetails(staff.staffId);

    return () => {
      cancelled = true;
    };
  }, [staff, isAlreadyDoctor, isAdmin]);

  const handleToggleExistingSpecialty = async (specialty: Specialty, linked: boolean) => {
    if (!staff || togglingSpecialtyId !== null) return;
    setTogglingSpecialtyId(specialty.specialtyId);
    setSubmitError(null);

    try {
      if (linked) {
        await unlinkDoctorSpecialty(staff.staffId, specialty.specialtyId);
        setDoctorProfile((prev) =>
          prev
            ? {
                ...prev,
                specialties: prev.specialties.filter(
                  (s) => s.specialtyId !== specialty.specialtyId,
                ),
              }
            : prev,
        );
        toast.success(`Removed ${specialty.specialtyName}`);
      } else {
        await linkDoctorSpecialty(staff.staffId, specialty.specialtyId);
        setDoctorProfile((prev) =>
          prev
            ? {
                ...prev,
                specialties: [...prev.specialties, specialty],
              }
            : prev,
        );
        toast.success(`Added ${specialty.specialtyName}`);
      }
      onSaved();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Failed to update doctor specialty.',
      );
    } finally {
      setTogglingSpecialtyId(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!isAdmin || !staff || isSubmitting) return;
    setSubmitError(null);

    const errors: AccountFieldErrors = {};
    const trimmedUsername = accountForm.username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    if (accountForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (accountForm.role === 'Doctor' && !isDoctor) {
      errors.role =
        'Staff member must have a doctor profile before assigning the Doctor role';
    }

    setAccountErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const createdAcc = await createUserAccount(staff.staffId, {
        username: trimmedUsername,
        tempPassword: accountForm.password,
        role: accountForm.role,
      });
      setHasAccount(true);
      setAccountProfile(createdAcc);
      setEditRole(createdAcc.role);
      setEditStatus(createdAcc.accountStatus);
      toast.success(`System account created for ${formatFullName(staff.firstName, staff.lastName)}`);
      onSaved();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Failed to create system account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!isAdmin || !staff || isSubmitting) return;
    setSubmitError(null);

    if (editRole === 'Doctor' && !isDoctor) {
      setSubmitError(
        'Staff member must have a doctor profile before assigning the Doctor role.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateUserAccount(staff.staffId, {
        role: editRole,
        accountStatus: editStatus,
      });
      setAccountProfile(updated);
      toast.success('Account settings updated');
      onSaved();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Failed to update account settings.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isAdmin || !staff || isSubmitting) return;
    setNewPasswordError(undefined);
    setSubmitError(null);

    if (newPassword.length < 6) {
      setNewPasswordError('New password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetStaffPassword(staff.staffId, { newPassword });
      setNewPassword('');
      toast.success('Password reset successfully');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Failed to reset password.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullName = staff ? formatFullName(staff.firstName, staff.lastName) : '';
  const linkedIds = new Set(
    (doctorProfile?.specialties ?? []).map((s) => s.specialtyId),
  );
  const effectiveTab: DrawerTab = isAdmin && !isDoctor ? 'account' : activeTab;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={fullName || 'Staff Member'}
      subtitle={
        staff
          ? `${staff.jobTitle} · ${staff.branchName ?? `Branch #${staff.branchId}`}`
          : undefined
      }
      footer={
        effectiveTab === 'doctor' || !isAdmin ? (
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Done
          </Button>
        ) : hasAccount ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Close
            </Button>
            {accountProfile && (
              <Button
                variant="primary"
                icon="save"
                onClick={handleUpdateAccount}
                isLoading={isSubmitting}
              >
                Save Account Changes
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="manage_accounts"
              onClick={handleCreateAccount}
              isLoading={isSubmitting}
            >
              Create Account
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isDoctor ? 'primary' : 'neutral'} pill>
              {isDoctor ? 'Doctor' : 'General Staff'}
            </Badge>
            <Badge tone={hasAccount ? 'success' : 'neutral'} pill>
              {hasAccount ? 'Has System Account' : 'No App Access'}
            </Badge>
          </div>
          {isAdmin && isDoctor && (
            <Tabs<DrawerTab>
              ariaLabel="Staff actions"
              value={effectiveTab}
              onChange={(tab) => {
                setSubmitError(null);
                setActiveTab(tab);
              }}
              items={[
                {
                  value: 'doctor',
                  label: 'Doctor Profile',
                },
                {
                  value: 'account',
                  label: hasAccount ? 'System Account' : 'Create Account',
                },
              ]}
            />
          )}
        </div>

        {submitError && <ErrorBanner message={submitError} />}
      </div>

      {isLoadingDetails ? (
        <p className="text-body-sm text-on-surface-variant">Loading staff details…</p>
      ) : effectiveTab === 'doctor' ? (
        isDoctor && doctorProfile ? (
          <>
            <DrawerSection title="Credentials" icon="verified">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                  <span className="block text-label-sm uppercase text-on-surface-variant">
                    License Number
                  </span>
                  <span className="mt-1 block font-mono text-body-md font-semibold text-on-surface">
                    {doctorProfile.licenseNo}
                  </span>
                </div>
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                  <span className="block text-label-sm uppercase text-on-surface-variant">
                    Consultation Fee
                  </span>
                  <span className="mt-1 block text-body-md font-semibold text-on-surface">
                    {formatCurrency(doctorProfile.consultationFee)}
                  </span>
                </div>
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                  <span className="block text-label-sm uppercase text-on-surface-variant">
                    Experience
                  </span>
                  <span className="mt-1 block text-body-md text-on-surface">
                    {doctorProfile.yearsOfExperience}{' '}
                    {doctorProfile.yearsOfExperience === 1 ? 'year' : 'years'}
                  </span>
                </div>
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                  <span className="block text-label-sm uppercase text-on-surface-variant">
                    Qualifications
                  </span>
                  <span className="mt-1 block text-body-md text-on-surface">
                    {doctorProfile.qualifications || '—'}
                  </span>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="Assigned Specialties" icon="stethoscope">
              {specialtiesError && (
                <ErrorBanner
                  message={specialtiesError}
                  onRetry={() => setSpecialtiesReloadTick((t) => t + 1)}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {doctorProfile.specialties.length === 0 ? (
                  <span className="text-body-sm text-on-surface-variant">
                    No specialties assigned yet.
                  </span>
                ) : (
                  doctorProfile.specialties.map((spec) => (
                    <Badge key={spec.specialtyId} tone="primary" pill>
                      {spec.specialtyName}
                    </Badge>
                  ))
                )}
              </div>

              {specialties.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 sm:grid-cols-2">
                  {specialties.map((spec) => {
                    const isLinked = linkedIds.has(spec.specialtyId);
                    return (
                      <Checkbox
                        key={spec.specialtyId}
                        label={spec.specialtyName}
                        checked={isLinked}
                        disabled={togglingSpecialtyId !== null}
                        onChange={() =>
                          handleToggleExistingSpecialty(spec, isLinked)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </DrawerSection>
          </>
        ) : (
          <p className="text-body-sm text-on-surface-variant">
            {isDoctor
              ? 'Unable to load doctor credentials.'
              : 'This staff member does not have a doctor profile.'}
          </p>
        )
      ) : hasAccount ? (
        accountProfile ? (
          <>
            <DrawerSection title="Account Access" icon="manage_accounts">
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
                <span className="block text-label-sm uppercase text-on-surface-variant">
                  Username
                </span>
                <span className="mt-1 block font-mono text-body-md font-semibold text-on-surface">
                  {accountProfile.username}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="System Role (5 Roles)"
                  options={ROLE_OPTIONS}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                />
                <Select
                  label="Account Status"
                  options={ACCOUNT_STATUS_OPTIONS}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                />
              </div>
            </DrawerSection>

            <DrawerSection title="Reset Password" icon="lock_reset">
              <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <Input
                  label="New Password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={newPasswordError}
                />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="key"
                    onClick={handleResetPassword}
                    isLoading={isSubmitting}
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            </DrawerSection>
          </>
        ) : (
          <DrawerSection title="Account Access" icon="manage_accounts">
            <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-body-sm text-on-surface-variant">
              This staff member already has a system login account. Only an Administrator can view or modify account credentials and roles.
            </p>
          </DrawerSection>
        )
      ) : (
        <DrawerSection title="Create System Account" icon="manage_accounts">
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 text-body-sm text-on-surface-variant">
            Any staff job title can have a system account. Create login access below and assign one of the 5 system roles to control app permissions.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Username"
              placeholder="e.g. nimal.perera"
              maxLength={50}
              value={accountForm.username}
              onChange={(e) =>
                setAccountForm((prev) => ({ ...prev, username: e.target.value }))
              }
              error={accountErrors.username}
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              maxLength={72}
              value={accountForm.password}
              onChange={(e) =>
                setAccountForm((prev) => ({ ...prev, password: e.target.value }))
              }
              error={accountErrors.password}
            />
            <div className="sm:col-span-2">
              <Select
                label="System Role (5 Roles)"
                options={ROLE_OPTIONS}
                value={accountForm.role}
                onChange={(e) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    role: e.target.value as Role,
                  }))
                }
                error={accountErrors.role}
                hint={
                  accountForm.role === 'Doctor' && !isDoctor
                    ? 'Note: Promote this staff member to a Doctor first before assigning the Doctor role.'
                    : undefined
                }
              />
            </div>
          </div>
        </DrawerSection>
      )}
    </Drawer>
  );
}
