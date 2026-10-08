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
    return <p className="text-body-md text-on-surface-variant">Loading consultation…</p>;
  }
  if (appointment.error || !appt) {
    return (
      <div className="max-w-xl mx-auto flex flex-col gap-3">
        <p className="text-body-md text-error">{appointment.error ?? 'Appointment not found.'}</p>
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
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-elevated">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-sm font-bold border border-outline-variant shrink-0">
            {getInitials(appt.patientName ?? '')}
          </div>
          <div>
            <h1 className="text-display-sm text-on-surface">{appt.patientName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {age !== null && <span className="text-body-md text-on-surface-variant">Age: {age}</span>}
              <span className="text-body-md text-on-surface-variant">Patient #{appt.patientId}</span>
              <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>{appt.status}</Badge>
              {appt.isWalkIn && <Badge tone="secondary">Walk-in</Badge>}
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-3 rounded border border-outline-variant max-w-sm w-full md:w-auto">
          <div className="text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">Appointment</div>
          <div className="text-body-md text-on-surface font-medium">
            {formatDate(appt.appointmentDate)} · {formatTime(appt.appointmentTime)}
          </div>
          <div className="text-body-sm text-on-surface-variant">
            Dr. {appt.doctorName} · {appt.branchName}
          </div>
        </div>
      </div>

      {!isDoctor && (
        <div className="rounded border border-tertiary/40 bg-tertiary/10 p-3 text-body-sm text-on-surface">
          Read-only view. Only the treating doctor can edit notes, log treatments or complete a visit.
        </div>
      )}
      {actionError && (
        <div className="rounded border border-error/40 bg-error/10 p-3 text-body-sm text-error">{actionError}</div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                <Icon name="edit_document" className="text-primary" />
                Clinical Notes
              </h2>
              {canEditNotes && (
                <div className="flex items-center gap-3">
                  {notesSavedAt && (
                    <span className="text-label-md text-on-surface-variant">Saved {notesSavedAt}</span>
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
          </div>

          {isDoctor && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                <h2 className="text-headline-sm text-on-surface">Logged Treatments</h2>
                <span className="text-body-md font-semibold text-on-surface">{formatCurrency(treatmentsTotal)}</span>
              </div>
              {treatments.error && <p className="p-4 text-body-sm text-error">{treatments.error}</p>}
              {records.length === 0 && !treatments.error && (
                <p className="p-4 text-body-sm text-on-surface-variant">
                  {status === 'Completed' ? 'No treatments logged yet.' : 'Treatments can be logged once the visit is completed.'}
                </p>
              )}
              <ul className="divide-y divide-outline-variant">
                {records.map((record) => {
                  const superseded = supersededIds.has(record.appointmentTreatmentId);
                  return (
                    <li key={record.appointmentTreatmentId} className="px-4 py-2 flex items-center justify-between gap-3">
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
            </div>
          )}
        </div>

        <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden h-full">
          <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
              <Icon name="medication" className="text-secondary" />
              Treatment Catalogue
            </h2>
            <div className="mt-3">
              <Input
                icon="search"
                placeholder="Search treatments..."
                value={catalogueQuery}
                onChange={(event) => setCatalogueQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {catalogue.error && <p className="text-body-sm text-error p-2">{catalogue.error}</p>}
            {catalogueItems.map((item) => (
              <div
                key={item.serviceCode}
                className="w-full flex items-center justify-between gap-2 p-2 mb-1 rounded border border-transparent hover:border-outline-variant hover:bg-surface-container-low"
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
            {!catalogue.isLoading && catalogueItems.length === 0 && (
              <p className="text-body-sm text-on-surface-variant text-center py-6">No treatments match your search.</p>
            )}
          </div>

          <div className="border-t border-outline-variant bg-surface-container-low p-4">
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
        </div>
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
