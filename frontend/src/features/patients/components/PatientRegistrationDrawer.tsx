import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { fetchBranches } from '../../../services/api/branches';
import { registerPatientWithDetails } from '../../../services/api/patientRegistration';
import type { RegistrationFailure } from '../../../services/api/patientRegistration';
import { useToast } from '../../../components/common/ToastProvider';
import type { Gender } from '../../../types';

export interface PatientRegistrationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the patient row was created (even if optional extras failed). */
  onRegistered: () => void;
  /** Called when the NIC already exists and the user wants to open that profile. */
  onViewExisting: (patientId: number) => void;
}

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

interface FormState {
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  branchId: string;
  phone: string;
  address: string;
  contactFirstName: string;
  contactLastName: string;
  contactRelationship: string;
  contactPhone: string;
}

const EMPTY_FORM: FormState = {
  nic: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  branchId: '',
  phone: '',
  address: '',
  contactFirstName: '',
  contactLastName: '',
  contactRelationship: '',
  contactPhone: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.nic.trim()) errors.nic = 'NIC / passport number is required';
  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  else if (new Date(form.dateOfBirth) > new Date()) errors.dateOfBirth = 'Date cannot be in the future';
  if (!form.gender) errors.gender = 'Select a gender';
  if (!form.branchId) errors.branchId = 'Select a branch';

  const contactStarted = [
    form.contactFirstName,
    form.contactLastName,
    form.contactRelationship,
    form.contactPhone,
  ].some((v) => v.trim());
  if (contactStarted) {
    if (!form.contactFirstName.trim()) errors.contactFirstName = 'Required';
    if (!form.contactLastName.trim()) errors.contactLastName = 'Required';
    if (!form.contactRelationship.trim()) errors.contactRelationship = 'Required';
  }
  return errors;
}

export function PatientRegistrationDrawer({
  isOpen,
  onClose,
  onRegistered,
  onViewExisting,
}: PatientRegistrationDrawerProps) {
  const { currentUser } = useAuth();
  const branches = useAsync(() => fetchBranches(1, 100), []);
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingPatientId, setExistingPatientId] = useState<number | null>(null);
  const [failures, setFailures] = useState<RegistrationFailure[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);

  // Fresh form (defaulting to the receptionist's own branch) every time the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_FORM, branchId: currentUser ? String(currentUser.branchId) : '' });
    setErrors({});
    setSubmitError(null);
    setExistingPatientId(null);
    setFailures([]);
  }, [isOpen, currentUser]);

  const set = <K extends keyof FormState>(key: K) =>
    (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value as FormState[K] }));

  const branchOptions = (branches.data?.items ?? []).map((b) => ({
    label: b.branchName,
    value: String(b.branchId),
  }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setExistingPatientId(null);

    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      const contactStarted = form.contactFirstName.trim() !== '';
      const result = await registerPatientWithDetails({
        patient: {
          nicPassportNo: form.nic.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender as Gender,
          address: form.address,
          registeredBranchId: Number(form.branchId),
        },
        phones: form.phone.trim()
          ? [{ phoneNumber: form.phone.trim(), phoneType: 'Mobile' }]
          : [],
        emergencyContact: contactStarted
          ? {
              relationship: form.contactRelationship.trim(),
              firstName: form.contactFirstName.trim(),
              lastName: form.contactLastName.trim(),
              phoneNumber: form.contactPhone.trim() || undefined,
              phoneType: form.contactPhone.trim() ? 'Mobile' : undefined,
            }
          : undefined,
      });

      onRegistered();
      if (result.failures.length === 0) {
        toast.success('Patient registered successfully.');
        onClose();
      } else {
        setFailures(result.failures);
        toast.info('Patient registered with some optional details not saved.');
      }
    } catch (err) {
      if (err instanceof ApiError && err.isConflict && err.existingPatientId !== undefined) {
        setExistingPatientId(err.existingPatientId);
        setSubmitError(err.message);
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
        toast.error(err.message);
      } else {
        setSubmitError('Something went wrong. Please try again.');
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const registered = failures.length > 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Patient"
      subtitle="Enter details to create a new patient record."
      footer={
        registered ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => (document.getElementById('patient-registration-form') as HTMLFormElement | null)?.requestSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : 'Save Patient'}
            </Button>
          </>
        )
      }
    >
      {registered && (
        <div className="rounded border border-tertiary/40 bg-tertiary/10 p-3 text-body-sm text-on-surface">
          <p className="font-medium">Patient registered, but some details were not saved:</p>
          <ul className="list-disc pl-5 mt-1">
            {failures.map((failure) => (
              <li key={failure.step + failure.message}>{failure.message}</li>
            ))}
          </ul>
          <p className="mt-1 text-on-surface-variant">
            You can add them from the patient&apos;s profile later.
          </p>
        </div>
      )}

      {!registered && (
        <form id="patient-registration-form" onSubmit={handleSubmit} noValidate className="contents">
          {submitError && (
            <div className="rounded border border-error/40 bg-error/10 p-3 text-body-sm text-error">
              <p>{submitError}</p>
              {existingPatientId !== null && (
                <button
                  type="button"
                  className="mt-1 underline font-medium"
                  onClick={() => onViewExisting(existingPatientId)}
                >
                  View existing patient profile
                </button>
              )}
            </div>
          )}

          <DrawerSection title="Personal Information" icon="badge">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="NIC / Passport No."
                  placeholder="e.g. 199012345678"
                  value={form.nic}
                  onChange={set('nic')}
                  error={errors.nic}
                  maxLength={20}
                />
              </div>
              <Input label="First Name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
              <Input label="Last Name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
              <Input
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                error={errors.dateOfBirth}
              />
              <Select
                label="Gender"
                placeholder="Select gender"
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={set('gender')}
                error={errors.gender}
              />
              <Select
                label="Branch"
                placeholder="Select branch"
                options={branchOptions}
                value={form.branchId}
                onChange={set('branchId')}
                error={errors.branchId}
              />
              <div className="sm:col-span-2">
                <Input label="Address" value={form.address} onChange={set('address')} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="Optional" />
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Emergency Contact" icon="contact_phone">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.contactFirstName}
                onChange={set('contactFirstName')}
                error={errors.contactFirstName}
              />
              <Input
                label="Last Name"
                value={form.contactLastName}
                onChange={set('contactLastName')}
                error={errors.contactLastName}
              />
              <Input
                label="Relationship"
                value={form.contactRelationship}
                onChange={set('contactRelationship')}
                error={errors.contactRelationship}
              />
              <Input
                label="Contact Phone"
                value={form.contactPhone}
                onChange={set('contactPhone')}
                placeholder="Optional"
              />
            </div>
          </DrawerSection>
        </form>
      )}
    </Drawer>
  );
}
