import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../../components/common/Modal';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { fetchBranches } from '../../../services/api/branches';
import { registerPatientWithDetails } from '../../../services/api/patientRegistration';
import { fetchPatientById, updatePatient } from '../../../services/api/patients';
import type { UpdatePatientInput } from '../../../services/api/patients';
import { addPatientPhone, deletePatientPhone, fetchPatientPhones } from '../../../services/api/patientPhones';
import {
  linkGuardianToPatient,
  unlinkGuardianFromPatient,
  fetchPatientGuardians,
} from '../../../services/api/patientGuardians';
import { addGuardianPhone } from '../../../services/api/guardians';
import type { Gender, Patient, PatientGuardianLink, Phone, PhoneType } from '../../../types';

export interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When non-null, modal runs in edit mode and preloads this patient. */
  patientId: number | null;
  onSaved: (patientId: number, mode: 'create' | 'edit') => void;
  onViewExisting: (patientId: number) => void;
}

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

interface PhoneEntry {
  localId: string;
  phoneId?: number;
  phoneNumber: string;
  phoneType: PhoneType;
}

interface GuardianEntry {
  localId: string;
  guardianId?: number;
  relationship: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface FormState {
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  branchId: string;
  address: string;
  phones: PhoneEntry[];
  guardians: GuardianEntry[];
}

type FieldErrors = Partial<Record<
  'nic' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'branchId',
  string
>> & { guardians?: string };

function makeLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPhone(): PhoneEntry {
  return { localId: makeLocalId('phone'), phoneNumber: '', phoneType: 'Mobile' };
}

function emptyGuardian(): GuardianEntry {
  return {
    localId: makeLocalId('guardian'),
    relationship: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  };
}

function emptyForm(branchId?: number): FormState {
  return {
    nic: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    branchId: branchId ? String(branchId) : '',
    address: '',
    phones: [emptyPhone()],
    guardians: [emptyGuardian()],
  };
}

function formFromServer(
  patient: Patient,
  phones: Phone[],
  guardians: PatientGuardianLink[],
): FormState {
  return {
    nic: patient.nicPassportNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    branchId: String(patient.registeredBranchId),
    address: patient.address ?? '',
    phones:
      phones.length > 0
        ? phones.map((phone) => ({
            localId: `p-${phone.phoneId}`,
            phoneId: phone.phoneId,
            phoneNumber: phone.phoneNumber,
            phoneType: phone.phoneType,
          }))
        : [emptyPhone()],
    guardians:
      guardians.length > 0
        ? guardians.map((link) => ({
            localId: `g-${link.guardianId}`,
            guardianId: link.guardianId,
            relationship: link.relationship,
            firstName: link.guardian?.firstName ?? '',
            lastName: link.guardian?.lastName ?? '',
            phoneNumber: '',
          }))
        : [emptyGuardian()],
  };
}

function validate(form: FormState): { errors: FieldErrors; hasErrors: boolean } {
  const errors: FieldErrors = {};
  if (!form.nic.trim()) errors.nic = 'NIC / passport number is required';
  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  else if (new Date(form.dateOfBirth) > new Date())
    errors.dateOfBirth = 'Date cannot be in the future';
  if (!form.gender) errors.gender = 'Select a gender';
  if (!form.branchId) errors.branchId = 'Select a branch';

  for (const g of form.guardians) {
    const started =
      g.firstName.trim() ||
      g.lastName.trim() ||
      g.relationship.trim() ||
      g.phoneNumber.trim();
    if (!started) continue;
    if (!g.firstName.trim() || !g.lastName.trim() || !g.relationship.trim()) {
      errors.guardians = 'Emergency contact requires first name, last name and relationship';
      break;
    }
  }

  return { errors, hasErrors: Object.keys(errors).length > 0 };
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Unexpected error';
}

export function PatientFormModal({
  isOpen,
  onClose,
  patientId,
  onSaved,
  onViewExisting,
}: PatientFormModalProps) {
  const { currentUser } = useAuth();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const isEdit = patientId !== null;
  const formId = useId();

  const branches = useAsync(() => fetchBranches(1, 100), []);
  const preload = useAsync(
    () =>
      !isEdit || !isReceptionist
        ? Promise.resolve(null)
        : Promise.all([
            fetchPatientById(patientId as number),
            fetchPatientPhones(patientId as number),
            fetchPatientGuardians(patientId as number),
          ]).then(([patient, phones, guardians]) => ({ patient, phones, guardians })),
    [patientId, isEdit, isReceptionist, isOpen],
  );

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [originalPhones, setOriginalPhones] = useState<Phone[]>([]);
  const [originalGuardians, setOriginalGuardians] = useState<PatientGuardianLink[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingPatientId, setExistingPatientId] = useState<number | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);

  // Populate form when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setSubmitError(null);
    setExistingPatientId(null);
    setFailures([]);

    if (isEdit && preload.data) {
      const next = formFromServer(
        preload.data.patient,
        preload.data.phones,
        preload.data.guardians,
      );
      setForm(next);
      setOriginalPhones(preload.data.phones);
      setOriginalGuardians(preload.data.guardians);
      setInitialSnapshot(JSON.stringify(next));
    } else if (!isEdit) {
      const next = emptyForm(currentUser?.branchId);
      setForm(next);
      setOriginalPhones([]);
      setOriginalGuardians([]);
      setInitialSnapshot(JSON.stringify(next));
    }
  }, [isOpen, isEdit, preload.data, currentUser]);

  const isDirty = useMemo(
    () => initialSnapshot !== '' && JSON.stringify(form) !== initialSnapshot,
    [form, initialSnapshot],
  );

  const branchOptions = useMemo(
    () =>
      (branches.data?.items ?? []).map((b) => ({
        label: b.branchName,
        value: String(b.branchId),
      })),
    [branches.data],
  );

  // ------ field helpers ------
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePhone = (localId: string, patch: Partial<PhoneEntry>) => {
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.map((p) => (p.localId === localId ? { ...p, ...patch } : p)),
    }));
  };

  const addPhoneRow = () => {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, emptyPhone()] }));
  };

  const removePhoneRow = (localId: string) => {
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.filter((p) => p.localId !== localId),
    }));
  };

  const updateGuardian = (localId: string, patch: Partial<GuardianEntry>) => {
    setForm((prev) => ({
      ...prev,
      guardians: prev.guardians.map((g) =>
        g.localId === localId ? { ...g, ...patch } : g,
      ),
    }));
  };

  const addGuardianRow = () => {
    setForm((prev) => ({ ...prev, guardians: [...prev.guardians, emptyGuardian()] }));
  };

  const removeGuardianRow = (localId: string) => {
    setForm((prev) => ({
      ...prev,
      guardians: prev.guardians.filter((g) => g.localId !== localId),
    }));
  };

  // ------ close handling ------
  const attemptClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const confirmDiscard = () => {
    setDiscardOpen(false);
    onClose();
  };

  // ------ create ------
  const handleCreate = async (): Promise<number> => {
    const filledPhones = form.phones.filter((p) => p.phoneNumber.trim());
    const firstGuardian = form.guardians.find(
      (g) =>
        g.firstName.trim() || g.lastName.trim() || g.relationship.trim() || g.phoneNumber.trim(),
    );

    const result = await registerPatientWithDetails({
      patient: {
        nicPassportNo: form.nic.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as Gender,
        address: form.address.trim() || undefined,
        registeredBranchId: Number(form.branchId),
      },
      phones: filledPhones.map((p) => ({
        phoneNumber: p.phoneNumber.trim(),
        phoneType: p.phoneType,
      })),
      emergencyContact: firstGuardian
        ? {
            relationship: firstGuardian.relationship.trim(),
            firstName: firstGuardian.firstName.trim(),
            lastName: firstGuardian.lastName.trim(),
            phoneNumber: firstGuardian.phoneNumber.trim() || undefined,
            phoneType: firstGuardian.phoneNumber.trim() ? 'Mobile' : undefined,
          }
        : undefined,
    });

    if (result.failures.length > 0) {
      setFailures(result.failures.map((f) => f.message));
    }
    return result.patient.patientId;
  };

  // ------ edit ------
  const handleEdit = async (): Promise<number> => {
    if (patientId === null) throw new Error('Edit mode requires patientId');
    const collected: string[] = [];
    const origPhones = originalPhones;
    const origGuardians = originalGuardians;

    // 1. Patient core fields
    const orig = preload.data?.patient;
    if (orig) {
      const updates: UpdatePatientInput = {};
      if (form.nic.trim() !== orig.nicPassportNo) updates.nicPassportNo = form.nic.trim();
      if (form.firstName.trim() !== orig.firstName) updates.firstName = form.firstName.trim();
      if (form.lastName.trim() !== orig.lastName) updates.lastName = form.lastName.trim();
      if (form.dateOfBirth !== orig.dateOfBirth) updates.dateOfBirth = form.dateOfBirth;
      if (form.gender && form.gender !== orig.gender) updates.gender = form.gender;
      const formAddr = form.address.trim() || null;
      const origAddr = orig.address?.trim() || null;
      if (formAddr !== origAddr) updates.address = formAddr;

      if (Object.keys(updates).length > 0) {
        try {
          await updatePatient(patientId, updates);
        } catch (error) {
          collected.push(`Patient record: ${messageOf(error)}`);
        }
      }
    }

    // 2. Phones — add new, delete removed, replace changed (delete + add)
    const keptIds = new Set<number>();
    for (const entry of form.phones) {
      const original = entry.phoneId
        ? origPhones.find((p) => p.phoneId === entry.phoneId)
        : undefined;
      const trimmed = entry.phoneNumber.trim();
      if (!trimmed) continue;

      if (!original) {
        // brand-new phone
        try {
          await addPatientPhone(patientId, {
            phoneNumber: trimmed,
            phoneType: entry.phoneType,
          });
        } catch (error) {
          collected.push(`Add phone ${trimmed}: ${messageOf(error)}`);
        }
      } else if (
        original.phoneNumber !== trimmed ||
        original.phoneType !== entry.phoneType
      ) {
        // replace: delete + re-add (no update endpoint exists)
        try {
          await deletePatientPhone(patientId, original.phoneId);
          await addPatientPhone(patientId, {
            phoneNumber: trimmed,
            phoneType: entry.phoneType,
          });
        } catch (error) {
          collected.push(`Update phone ${trimmed}: ${messageOf(error)}`);
        }
      }
      if (original) keptIds.add(original.phoneId);
    }
    for (const original of origPhones) {
      if (!keptIds.has(original.phoneId)) {
        // was not retained (removed or replaced) — replacement already handled above
        const stillInForm = form.phones.some((p) => p.phoneId === original.phoneId);
        if (!stillInForm) {
          try {
            await deletePatientPhone(patientId, original.phoneId);
          } catch (error) {
            collected.push(`Remove phone ${original.phoneNumber}: ${messageOf(error)}`);
          }
        }
      }
    }

    // 3. Guardians — add new links, unlink removed links
    const keptGuardianIds = new Set<number>();
    for (const entry of form.guardians) {
      const started =
        entry.firstName.trim() ||
        entry.lastName.trim() ||
        entry.relationship.trim() ||
        entry.phoneNumber.trim();
      if (!started) continue;

      if (!entry.guardianId) {
        // new guardian — link, and add phone if provided
        try {
          const link = await linkGuardianToPatient(patientId, {
            relationship: entry.relationship.trim(),
            newGuardian: {
              firstName: entry.firstName.trim(),
              lastName: entry.lastName.trim(),
            },
          });
          if (entry.phoneNumber.trim()) {
            try {
              await addGuardianPhone(link.guardianId, {
                phoneNumber: entry.phoneNumber.trim(),
                phoneType: 'Mobile',
              });
            } catch (error) {
              collected.push(`Guardian phone: ${messageOf(error)}`);
            }
          }
        } catch (error) {
          collected.push(`Add guardian: ${messageOf(error)}`);
        }
      } else {
        keptGuardianIds.add(entry.guardianId);
      }
    }
    for (const original of origGuardians) {
      if (!keptGuardianIds.has(original.guardianId)) {
        try {
          await unlinkGuardianFromPatient(patientId, original.guardianId);
        } catch (error) {
          collected.push(`Remove guardian link: ${messageOf(error)}`);
        }
      }
    }

    if (collected.length > 0) setFailures(collected);
    return patientId;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);
    setExistingPatientId(null);
    setFailures([]);

    const { errors: fieldErrors, hasErrors } = validate(form);
    setErrors(fieldErrors);
    if (hasErrors) {
      const firstKey = Object.keys(fieldErrors)[0];
      const el = formRef.current?.querySelector<HTMLElement>(
        `[data-field="${firstKey}"]`,
      );
      el?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const savedId = isEdit ? await handleEdit() : await handleCreate();
      onSaved(savedId, isEdit ? 'edit' : 'create');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.isConflict &&
        error.existingPatientId !== undefined
      ) {
        setExistingPatientId(error.existingPatientId);
        setSubmitError('A patient with this NIC already exists');
      } else if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !isReceptionist) return null;

  const preloadReady = !isEdit || preload.data !== undefined;
  const title = isEdit ? 'Edit patient' : 'Register patient';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={attemptClose}
        title={title}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={attemptClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              isLoading={isSubmitting}
              disabled={!preloadReady}
            >
              Save
            </Button>
          </>
        }
      >
        {!preloadReady ? (
          <div className="flex flex-col gap-4">
            <Skeleton height={200} rounded="xl" />
            <Skeleton height={140} rounded="xl" />
          </div>
        ) : (
          <form
            id={formId}
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >
            {submitError && (
              <div role="alert" className="flex flex-col gap-2">
                <ErrorBanner message={submitError} />
                {existingPatientId !== null && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="open_in_new"
                    onClick={() => onViewExisting(existingPatientId)}
                  >
                    Open record
                  </Button>
                )}
              </div>
            )}

            {failures.length > 0 && (
              <div
                role="status"
                className="rounded-xl border border-warning/30 bg-warning-container px-4 py-3 text-body-sm text-on-warning-container"
              >
                <p className="font-semibold">Some details were not saved:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {failures.map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Personal information */}
            <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
              <h3 className="mb-4 text-headline-sm text-on-surface">Personal information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2" data-field="nic">
                  <Input
                    label="NIC / Passport No."
                    value={form.nic}
                    onChange={(event) => setField('nic', event.target.value)}
                    error={errors.nic}
                    maxLength={20}
                  />
                </div>
                <div data-field="firstName">
                  <Input
                    label="First name"
                    value={form.firstName}
                    onChange={(event) => setField('firstName', event.target.value)}
                    error={errors.firstName}
                  />
                </div>
                <div data-field="lastName">
                  <Input
                    label="Last name"
                    value={form.lastName}
                    onChange={(event) => setField('lastName', event.target.value)}
                    error={errors.lastName}
                  />
                </div>
                <div data-field="dateOfBirth">
                  <Input
                    label="Date of birth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => setField('dateOfBirth', event.target.value)}
                    error={errors.dateOfBirth}
                  />
                </div>
                <div data-field="gender">
                  <Select
                    label="Gender"
                    placeholder="Select gender"
                    options={GENDER_OPTIONS}
                    value={form.gender}
                    onChange={(event) =>
                      setField('gender', event.target.value as Gender | '')
                    }
                    error={errors.gender}
                  />
                </div>
                <div data-field="branchId">
                  <Select
                    label="Branch"
                    placeholder="Select branch"
                    options={branchOptions}
                    value={form.branchId}
                    onChange={(event) => setField('branchId', event.target.value)}
                    error={errors.branchId}
                    disabled={isEdit}
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label="Address"
                    value={form.address}
                    onChange={(event) => setField('address', event.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Phone numbers */}
            <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-headline-sm text-on-surface">Phone numbers</h3>
                <Button variant="ghost" size="sm" icon="add" onClick={addPhoneRow}>
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {form.phones.map((phone) => (
                  <div key={phone.localId} className="grid gap-3 md:grid-cols-[1fr_10rem_auto]">
                    <Input
                      label="Phone number"
                      value={phone.phoneNumber}
                      onChange={(event) =>
                        updatePhone(phone.localId, { phoneNumber: event.target.value })
                      }
                    />
                    <Select
                      label="Type"
                      options={PHONE_TYPE_OPTIONS}
                      value={phone.phoneType}
                      onChange={(event) =>
                        updatePhone(phone.localId, {
                          phoneType: event.target.value as PhoneType,
                        })
                      }
                    />
                    <div className="flex items-end pb-1">
                      <IconButton
                        icon="delete"
                        size="md"
                        aria-label="Remove phone"
                        onClick={() => removePhoneRow(phone.localId)}
                        disabled={form.phones.length === 1 && !phone.phoneId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Emergency contact */}
            <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-headline-sm text-on-surface">Emergency contact</h3>
                <Button variant="ghost" size="sm" icon="add" onClick={addGuardianRow}>
                  Add
                </Button>
              </div>
              {errors.guardians && (
                <p className="mb-3 text-label-md text-error">{errors.guardians}</p>
              )}
              <div className="flex flex-col gap-4">
                {form.guardians.map((guardian) => (
                  <div
                    key={guardian.localId}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    <Input
                      label="First name"
                      value={guardian.firstName}
                      onChange={(event) =>
                        updateGuardian(guardian.localId, {
                          firstName: event.target.value,
                        })
                      }
                      disabled={guardian.guardianId !== undefined}
                    />
                    <Input
                      label="Last name"
                      value={guardian.lastName}
                      onChange={(event) =>
                        updateGuardian(guardian.localId, {
                          lastName: event.target.value,
                        })
                      }
                      disabled={guardian.guardianId !== undefined}
                    />
                    <Input
                      label="Relationship"
                      value={guardian.relationship}
                      onChange={(event) =>
                        updateGuardian(guardian.localId, {
                          relationship: event.target.value,
                        })
                      }
                      disabled={guardian.guardianId !== undefined}
                    />
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                      <Input
                        label="Contact phone"
                        value={guardian.phoneNumber}
                        onChange={(event) =>
                          updateGuardian(guardian.localId, {
                            phoneNumber: event.target.value,
                          })
                        }
                        disabled={guardian.guardianId !== undefined}
                        placeholder={guardian.guardianId !== undefined ? '—' : 'Optional'}
                      />
                      <IconButton
                        icon="delete"
                        size="md"
                        aria-label="Remove emergency contact"
                        onClick={() => removeGuardianRow(guardian.localId)}
                        disabled={form.guardians.length === 1 && !guardian.guardianId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={discardOpen}
        title="Discard changes?"
        message="Your unsaved changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}
