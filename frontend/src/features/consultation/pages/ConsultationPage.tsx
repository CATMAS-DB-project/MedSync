import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Card } from '../../../components/ui/Card';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { completeAppointment, fetchAppointmentById } from '../../../services/api/appointments';
import { fetchAppointmentTreatments } from '../../../services/api/appointmentTreatments';
import { fetchPatientById } from '../../../services/api/patients';
import { calculateAge, formatDate, formatFullName, formatTime } from '../../../utils/formatters';
import { ROUTES } from '../../../constants/routes';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { PatientDetailDrawer } from '../../patients/components/PatientDetailDrawer';
import { ConsultationNotesCard } from '../components/ConsultationNotesCard';
import { ConsultationTreatmentsCard } from '../components/ConsultationTreatmentsCard';
import { AddTreatmentModal } from '../components/AddTreatmentModal';
import { AmendTreatmentModal } from '../components/AmendTreatmentModal';
import type {
  AppointmentTreatment,
  BatchTreatmentCreateResult,
} from '../../../types';

export function ConsultationPage() {
  const { appointmentId: idParam } = useParams();
  const appointmentId = Number(idParam);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isDoctor = currentUser?.role === 'Doctor';
  const isAdmin = currentUser?.role === 'Admin';
  const isAllowedRole = isDoctor || isAdmin;

  const [actionError, setActionError] = useState<string | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPreparingToAdd, setIsPreparingToAdd] = useState(false);
  const [toAmend, setToAmend] = useState<AppointmentTreatment | null>(null);
  const [patientDrawerOpen, setPatientDrawerOpen] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const appointment = useAsync(
    () =>
      Number.isNaN(appointmentId) || appointmentId <= 0
        ? Promise.reject(new Error('Invalid appointment id'))
        : fetchAppointmentById(appointmentId),
    [appointmentId],
  );
  const appt = appointment.data;

  const isOwnAppointment =
    !isDoctor || (appt && currentUser ? appt.doctorStaffId === currentUser.staffId : true);

  const patient = useAsync(
    () => (appt ? fetchPatientById(appt.patientId) : Promise.resolve(null)),
    [appt?.patientId],
  );

  const treatments = useAsync(
    () =>
      isDoctor && appt
        ? fetchAppointmentTreatments(appointmentId)
        : Promise.resolve([] as AppointmentTreatment[]),
    [appointmentId, isDoctor, appt?.appointmentId],
  );

  const flushNotesRef = useRef<() => Promise<void>>(async () => undefined);
  const registerFlush = useCallback((flush: () => Promise<void>) => {
    flushNotesRef.current = flush;
  }, []);

  const backTo = isDoctor ? ROUTES.DOCTOR_HOME : ROUTES.APPOINTMENTS;

  // ---- Complete visit (explicit path) ----
  const handleComplete = useCallback(async () => {
    if (
      !isDoctor ||
      !appt ||
      (appt.status !== 'Scheduled' && appt.status !== 'Re-Scheduled')
    ) {
      return;
    }
    setIsCompleting(true);
    setActionError(null);
    try {
      await flushNotesRef.current();
      await completeAppointment(appointmentId);
      if (!isMountedRef.current) return;
      setIsCompleteOpen(false);
      toast.success('Visit completed');
      appointment.reload();
      treatments.reload();
    } catch (err) {
      if (!isMountedRef.current) return;
      setActionError(err instanceof ApiError ? err.message : 'Could not complete the visit.');
      setIsCompleteOpen(false);
    } finally {
      if (isMountedRef.current) setIsCompleting(false);
    }
  }, [isDoctor, appt, appointmentId, appointment, treatments, toast]);

  // ---- Add treatment (chained: flush → complete if needed → open picker) ----
  const handleAddTreatmentClick = useCallback(async () => {
    if (!isDoctor || !appt || !isOwnAppointment) return;
    if (appt.status === 'Cancelled') return;
    if (isPreparingToAdd) return;

    setIsPreparingToAdd(true);
    setActionError(null);

    try {
      // 1. Flush any pending notes so the completion step saves them too.
      await flushNotesRef.current();
      if (!isMountedRef.current) return;

      // 2. Complete the visit if it's still Scheduled / Re-Scheduled. The backend only accepts
      //    treatment logging on Completed appointments.
      if (appt.status === 'Scheduled' || appt.status === 'Re-Scheduled') {
        await completeAppointment(appointmentId);
        if (!isMountedRef.current) return;
        // Reload so the header badge and the invoice state refresh behind the modal.
        appointment.reload();
        treatments.reload();
      }

      // 3. Open the treatment picker.
      setIsAddOpen(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Could not prepare the visit for treatment logging.',
      );
    } finally {
      if (isMountedRef.current) setIsPreparingToAdd(false);
    }
  }, [
    isDoctor,
    appt,
    isOwnAppointment,
    isPreparingToAdd,
    appointmentId,
    appointment,
    treatments,
  ]);

  const status = appt?.status;
  const isActiveVisit = status === 'Scheduled' || status === 'Re-Scheduled';
  const canEditNotes = isDoctor && isOwnAppointment && isActiveVisit;
  // Doctors can act on treatments from the moment they land on the page, as long
  // as the appointment is not Cancelled. The chained action handles the
  // Scheduled/Re-Scheduled → Completed transition internally.
  const canManageTreatments =
    isDoctor &&
    isOwnAppointment &&
    status !== 'Cancelled';
  const canAmendTreatments = canManageTreatments && status === 'Completed';
  const canAddTreatments = canManageTreatments;

  const statusBadge = appt ? (
    <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]} dot pill>
      {appt.status}
    </Badge>
  ) : undefined;

  const showStickyBar =
    isDoctor && isOwnAppointment && (isActiveVisit || status === 'Completed');

  // ---- Loading / errors / guards ----
  if (appointment.isLoading && !appt) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <Skeleton height={32} width={200} rounded="lg" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Skeleton height={320} rounded="xl" />
            <Skeleton height={240} rounded="xl" />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-1">
            <Skeleton height={140} rounded="xl" />
            <Skeleton height={180} rounded="xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAllowedRole || appointment.error || !appt || !isOwnAppointment) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState
          icon="search_off"
          title="Appointment not found"
          action={
            <Button variant="secondary" onClick={() => navigate(backTo)}>
              Back
            </Button>
          }
        />
      </div>
    );
  }

  const patientFullName = patient.data
    ? formatFullName(patient.data.firstName, patient.data.lastName)
    : appt.patientName ?? 'Patient';
  const age = patient.data ? calculateAge(patient.data.dateOfBirth) : null;
  const gender = patient.data?.gender;
  const nic = patient.data?.nicPassportNo;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-24 lg:pb-0">
      <PageHeader title="Consultation" backTo={backTo} actions={statusBadge} />

      {status === 'Cancelled' && (
        <div className="flex items-start gap-2 rounded-2xl bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
          <Icon name="event_busy" size={18} className="mt-0.5 shrink-0" />
          <span>This appointment was cancelled</span>
        </div>
      )}

      {status === 'Re-Scheduled' && (
        <div className="flex items-start gap-2 rounded-2xl bg-secondary-container/60 px-4 py-3 text-body-sm text-on-secondary-container">
          <Icon name="event_repeat" size={18} className="mt-0.5 shrink-0" />
          <span>
            This appointment was rescheduled
            {appt.cancelRescheduleReason ? ` (${appt.cancelRescheduleReason})` : ''}
          </span>
        </div>
      )}

      {actionError && (
        <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left (2/3) — notes + treatments */}
        <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-2">
          <ConsultationNotesCard
            key={appt.appointmentId}
            appointmentId={appt.appointmentId}
            initialNotes={appt.consultationNotes ?? ''}
            canEdit={canEditNotes}
            registerFlush={registerFlush}
          />

          {isDoctor && (
            <ConsultationTreatmentsCard
              status={appt.status}
              records={treatments.data ?? []}
              loading={treatments.isLoading}
              error={treatments.error}
              onRetry={treatments.reload}
              canAmend={canAmendTreatments}
              canAdd={canAddTreatments}
              isPreparingToAdd={isPreparingToAdd}
              onAmend={setToAmend}
              onAdd={handleAddTreatmentClick}
            />
          )}
        </div>

        {/* Right (1/3) — patient + appointment */}
        <aside className="order-1 flex flex-col gap-6 lg:order-2 lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
          <Card padding="lg">
            <div className="flex items-center gap-3">
              <Avatar name={patientFullName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-headline-sm text-on-surface">
                  {patientFullName}
                </div>
                {patient.isLoading && patient.data === undefined ? (
                  <Skeleton height={12} width="60%" rounded="sm" />
                ) : (
                  <>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {age !== null && (
                        <Badge tone="neutral" pill>
                          {age} yrs
                        </Badge>
                      )}
                      {gender && (
                        <Badge tone="info" pill>
                          {gender}
                        </Badge>
                      )}
                    </div>
                    {nic && (
                      <div className="mt-1 truncate text-label-md text-on-surface-variant">
                        {nic}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {patient.data && (
              <Button
                variant="secondary"
                size="sm"
                icon="person"
                onClick={() => setPatientDrawerOpen(true)}
                className="mt-3 w-full"
              >
                View full record
              </Button>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="text-headline-sm text-on-surface">Appointment</h2>
            <dl className="mt-3 flex flex-col gap-1.5">
              <KeyValue label="Date" value={formatDate(appt.appointmentDate)} />
              <KeyValue label="Time" value={formatTime(appt.appointmentTime)} />
              <KeyValue label="Doctor" value={appt.doctorName ?? '—'} />
              <KeyValue label="Branch" value={appt.branchName ?? '—'} />
              <KeyValue
                label="Status"
                value={
                  <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]} dot pill>
                    {appt.status}
                  </Badge>
                }
              />
              {appt.isWalkIn && (
                <KeyValue
                  label="Type"
                  value={
                    <Badge tone="secondary" pill>
                      Walk-in
                    </Badge>
                  }
                />
              )}
            </dl>
          </Card>
        </aside>
      </div>

      {showStickyBar && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-3 lg:sticky lg:bottom-4 lg:left-auto lg:right-auto lg:inset-x-auto">
          <div className="mx-auto w-full max-w-[1400px]">
            <Card padding="md" className="shadow-modal">
              <div className="flex justify-end gap-2">
                {isActiveVisit && (
                  <Button
                    variant="primary"
                    icon="check_circle"
                    onClick={() => setIsCompleteOpen(true)}
                    disabled={isCompleting || isPreparingToAdd}
                    isLoading={isCompleting}
                    className="w-full sm:w-auto"
                  >
                    Complete visit
                  </Button>
                )}
                {status === 'Completed' && (
                  <Button
                    variant="secondary"
                    icon="arrow_back"
                    onClick={() => navigate(ROUTES.DOCTOR_HOME)}
                    className="w-full sm:w-auto"
                  >
                    Back to home
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isCompleteOpen}
        title="Complete visit?"
        message="An invoice will be created for billing. You can still add treatments afterwards."
        confirmLabel="Complete visit"
        cancelLabel="Cancel"
        tone="default"
        isPending={isCompleting}
        onConfirm={handleComplete}
        onCancel={() => {
          if (isCompleting) return;
          setIsCompleteOpen(false);
        }}
      />

      <AddTreatmentModal
        isOpen={isAddOpen}
        appointmentId={appt.appointmentId}
        onClose={() => setIsAddOpen(false)}
        onAdded={(result: BatchTreatmentCreateResult) => {
          treatments.reload();
          const createdCount = result.created.length;
          const failedCount = result.failed.length;
          toast.success(
            failedCount === 0
              ? `${createdCount} treatment${createdCount === 1 ? '' : 's'} logged`
              : `${createdCount} treatment${createdCount === 1 ? '' : 's'} logged, ${failedCount} failed`,
          );
        }}
      />

      <AmendTreatmentModal
        record={toAmend}
        onClose={() => setToAmend(null)}
        onAmended={() => {
          treatments.reload();
          toast.success('Treatment amended');
        }}
      />

      <PatientDetailDrawer
        patientId={patientDrawerOpen ? appt.patientId : null}
        onClose={() => setPatientDrawerOpen(false)}
      />
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-outline-variant/60 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-label-md text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 truncate text-right text-body-sm text-on-surface">{value}</dd>
    </div>
  );
}
