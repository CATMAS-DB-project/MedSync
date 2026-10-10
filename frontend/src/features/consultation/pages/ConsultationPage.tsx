import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { TextArea } from '../../../components/ui/TextArea';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { completeAppointment, fetchAppointmentById } from '../../../services/api/appointments';
import {
  fetchAppointmentTreatments,
  logAppointmentTreatment,
  saveConsultationNotes,
} from '../../../services/api/appointmentTreatments';
import { fetchPatientById } from '../../../services/api/patients';
import { fetchTreatments } from '../../../services/api/treatments';
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatTime,
  getInitials,
} from '../../../utils/formatters';
import { ROUTES } from '../../../constants/routes';
import { APPOINTMENT_STATUS_TONE } from '../../appointments/statusStyles';
import { AmendTreatmentDrawer } from '../components/AmendTreatmentDrawer';
import type { AppointmentTreatment } from '../../../types';

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function ConsultationPage() {
  const navigate = useNavigate();
  const { appointmentId: idParam } = useParams();
  const appointmentId = Number(idParam);
  const { currentUser } = useAuth();

  // Backend: only Doctors can write notes/treatments/complete, and only
  // Doctors and Receptionists may read the treatment list. Admin gets a read-only view.
  const isDoctor = currentUser?.role === 'Doctor';

  const appointment = useAsync(() => fetchAppointmentById(appointmentId), [appointmentId]);
  const appt = appointment.data;
  const patient = useAsync(
    () => (appt ? fetchPatientById(appt.patientId) : Promise.resolve(null)),
    [appt?.patientId],
  );
  const catalogue = useAsync(() => fetchTreatments(undefined, 1, 100), []);
  const treatments = useAsync(
    () => (isDoctor ? fetchAppointmentTreatments(appointmentId) : Promise.resolve([] as AppointmentTreatment[])),
    [appointmentId, isDoctor],
  );

  const [notes, setNotes] = useState('');
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [isSavingNotes, setSavingNotes] = useState(false);
  const [isCompleting, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toAmend, setToAmend] = useState<AppointmentTreatment | null>(null);

  useEffect(() => {
    if (appt) setNotes(appt.consultationNotes ?? '');
  }, [appt?.appointmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalogueItems = useMemo(
    () =>
      (catalogue.data?.items ?? []).filter((item) =>
        `${item.treatmentName} ${item.serviceCode}`.toLowerCase().includes(catalogueQuery.toLowerCase()),
      ),
    [catalogue.data, catalogueQuery],
  );

  const records = treatments.data ?? [];
  // A record that has been corrected by an amendment is superseded and not counted.
  const supersededIds = new Set(records.map((r) => r.originalRecordId).filter((id) => id != null));
  const activeRecords = records.filter((r) => !supersededIds.has(r.appointmentTreatmentId));
  const treatmentsTotal = activeRecords.reduce((sum, r) => sum + Number(r.priceAtTime), 0);

  const status = appt?.status;
  const canEditNotes = isDoctor && status !== 'Cancelled';
  const canComplete = isDoctor && status === 'Scheduled';
  const canLogTreatments = isDoctor && status === 'Completed';

  async function handleSaveNotes() {
    setSavingNotes(true);
    setActionError(null);
    try {
      await saveConsultationNotes(appointmentId, notes);
      setNotesSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setActionError(messageOf(err, 'Could not save notes.'));
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleComplete() {
    const confirmed = window.confirm(
      'Complete this visit? An invoice will be created automatically. You can still log treatments afterwards.',
    );
    if (!confirmed) return;
    setCompleting(true);
    setActionError(null);
    try {
      // Save any unsaved notes first so nothing is lost.
      await saveConsultationNotes(appointmentId, notes);
      await completeAppointment(appointmentId);
      appointment.reload();
      treatments.reload();
    } catch (err) {
      setActionError(messageOf(err, 'Could not complete the visit.'));
    } finally {
      setCompleting(false);
    }
  }

  async function handleLogTreatment(serviceCode: string) {
    setBusyCode(serviceCode);
    setActionError(null);
    try {
      await logAppointmentTreatment(appointmentId, { service_code: serviceCode });
      treatments.reload();
    } catch (err) {
      setActionError(messageOf(err, 'Could not log the treatment.'));
    } finally {
      setBusyCode(null);
    }
  }

  if (appointment.isLoading && !appt) {
    return (
      <div className="mx-auto flex min-h-48 w-full max-w-7xl items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface-variant shadow-elevated">
        <span className="inline-flex items-center gap-2">
          <Icon name="progress_activity" className="animate-spin text-primary" />
          Loading consultation…
        </span>
      </div>
    );
  }
  if (appointment.error || !appt) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-error/30 bg-error-container/30 p-6">
        <p role="alert" className="text-body-md text-on-error-container">{appointment.error ?? 'Appointment not found.'}</p>
        <div>
          <Button variant="secondary" onClick={() => navigate(ROUTES.APPOINTMENTS)}>
            Back to Appointments
          </Button>
        </div>
      </div>
    );
  }

  const age = calculateAge(patient.data?.dateOfBirth);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
      <div className="relative isolate flex flex-col justify-between gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated md:flex-row md:items-center md:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-36 z-0 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-headline-sm font-bold text-white shadow-elevated backdrop-blur-sm">
            {getInitials(appt.patientName ?? '')}
          </div>
          <div className="min-w-0">
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Clinical consultation</p>
            <h1 className="truncate text-display-sm text-white">{appt.patientName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {age !== null && <span className="rounded-full bg-white/10 px-2.5 py-1 text-label-md text-white">Age {age}</span>}
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-label-md text-white">Patient #{appt.patientId}</span>
              <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>{appt.status}</Badge>
              {appt.isWalkIn && <Badge tone="secondary">Walk-in</Badge>}
            </div>
          </div>
        </div>
        <div className="relative z-10 w-full rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm md:w-auto md:min-w-64">
          <div className="mb-1 flex items-center gap-2 text-label-md font-semibold uppercase tracking-wider text-white/75">
            <Icon name="event" size={16} />
            Appointment
          </div>
          <div className="text-body-md font-semibold text-white">
            {formatDate(appt.appointmentDate)} · {formatTime(appt.appointmentTime)}
          </div>
          <div className="mt-1 text-body-sm text-white/80">
            Dr. {appt.doctorName} · {appt.branchName}
          </div>
        </div>
      </div>

      {!isDoctor && (
        <div className="flex items-start gap-2 rounded-xl border border-tertiary/30 bg-tertiary/10 p-4 text-body-sm text-on-surface">
          <Icon name="visibility" size={18} className="mt-0.5 shrink-0 text-tertiary" />
          Read-only view. Only the treating doctor can edit notes, log treatments or complete a visit.
        </div>
      )}
      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/50 p-4 text-body-sm text-on-error-container">
          <Icon name="error" size={18} className="mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <section className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-3 sm:px-5">
              <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                <Icon name="edit_document" className="text-primary" />
                Clinical Notes
              </h2>
              {canEditNotes && (
                <div className="flex items-center gap-3">
                  {notesSavedAt && (
                    <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
                      <Icon name="check_circle" size={16} className="text-success" />
                      Saved {notesSavedAt}
                    </span>
                  )}
                  <Button variant="secondary" size="sm" onClick={handleSaveNotes} disabled={isSavingNotes}>
                    {isSavingNotes ? 'Saving…' : 'Save Notes'}
                  </Button>
                </div>
              )}
            </div>
            <TextArea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              readOnly={!canEditNotes}
              placeholder="Enter objective findings, assessment, and plan here..."
              className="w-full min-h-[240px] border-none rounded-none focus:ring-0"
              rows={10}
            />
          </section>

          {isDoctor && (
            <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-3 sm:px-5">
                <h2 className="text-headline-sm text-on-surface">Logged Treatments</h2>
                <span className="rounded-full bg-secondary-fixed/50 px-3 py-1 text-body-md font-semibold text-on-secondary-fixed">{formatCurrency(treatmentsTotal)}</span>
              </div>
              {treatments.error && <p role="alert" className="m-4 rounded-lg border border-error/30 bg-error-container/50 p-3 text-body-sm text-on-error-container">{treatments.error}</p>}
              {records.length === 0 && !treatments.error && (
                <p className="m-4 rounded-lg bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                  {status === 'Completed' ? 'No treatments logged yet.' : 'Treatments can be logged once the visit is completed.'}
                </p>
              )}
              <ul className="divide-y divide-outline-variant">
                {records.map((record) => {
                  const superseded = supersededIds.has(record.appointmentTreatmentId);
                  return (
                    <li key={record.appointmentTreatmentId} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low sm:px-5">
                      <div className={superseded ? 'line-through text-on-surface-variant' : ''}>
                        <div className="text-body-sm text-on-surface">{record.treatmentName ?? record.serviceCode}</div>
                        <div className="text-label-md text-on-surface-variant">
                          {record.serviceCode}
                          {record.isAmended && record.amendmentReason ? ` · Amended: ${record.amendmentReason}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-body-sm">{formatCurrency(Number(record.priceAtTime))}</span>
                        {canLogTreatments && !superseded && (
                          <button
                            type="button"
                            onClick={() => setToAmend(record)}
                            className="text-primary text-label-md hover:underline"
                          >
                            Amend
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
          <div className="border-b border-outline-variant bg-gradient-to-r from-secondary-fixed/30 to-primary-fixed/20 px-4 py-4 sm:px-5">
            <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-fixed/70">
                <Icon name="medication" className="text-secondary" />
              </span>
              Treatment Catalogue
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">Browse and search available treatments.</p>
            <div className="mt-3">
              <Input
                label="Search catalogue"
                icon="search"
                placeholder="Search treatments..."
                value={catalogueQuery}
                onChange={(event) => setCatalogueQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {catalogue.error && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/50 p-3 text-body-sm text-on-error-container">{catalogue.error}</p>}
            {catalogueItems.map((item) => (
              <div
                key={item.serviceCode}
                className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-3 transition-colors hover:border-primary/30 hover:bg-primary-fixed/20"
              >
                <div>
                  <div className="text-body-sm text-on-surface">{item.treatmentName}</div>
                  <div className="text-label-md text-on-surface-variant">
                    {item.serviceCode} · {item.category} · {formatCurrency(item.unitPrice)}
                  </div>
                </div>
                {canLogTreatments && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleLogTreatment(item.serviceCode)}
                    disabled={busyCode !== null}
                  >
                    {busyCode === item.serviceCode ? '…' : 'Add'}
                  </Button>
                )}
              </div>
            ))}
            {catalogue.isLoading && (
              <p className="py-6 text-center text-body-sm text-on-surface-variant">Loading treatments…</p>
            )}
            {!catalogue.isLoading && catalogueItems.length === 0 && (
              <p className="py-6 text-center text-body-sm text-on-surface-variant">No treatments match your search.</p>
            )}
          </div>

          <div className="border-t border-outline-variant bg-gradient-to-r from-primary-fixed/20 to-secondary-fixed/20 p-4">
            {status === 'Scheduled' && isDoctor && (
              <p className="text-body-sm text-on-surface-variant mb-3">
                Complete the visit first. Treatments are logged afterwards and added to the invoice.
              </p>
            )}
            {status === 'Cancelled' && (
              <p className="text-body-sm text-on-surface-variant mb-3">
                This appointment was cancelled{appt.cancelRescheduleReason ? `: ${appt.cancelRescheduleReason}` : '.'}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {canComplete && (
                <Button
                  variant="primary"
                  icon="check_circle"
                  className="w-full"
                  onClick={handleComplete}
                  disabled={isCompleting}
                >
                  {isCompleting ? 'Completing…' : 'Complete Visit'}
                </Button>
              )}
              {status === 'Completed' && (
                <Button variant="secondary" className="w-full" onClick={() => navigate(ROUTES.APPOINTMENTS)}>
                  Done — Back to Appointments
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AmendTreatmentDrawer
        record={toAmend}
        catalogue={catalogue.data?.items ?? []}
        onClose={() => setToAmend(null)}
        onAmended={treatments.reload}
      />
    </div>
  );
}
