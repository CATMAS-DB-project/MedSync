import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ApiError } from '../../../services/api/ApiError';
import { bookAppointment, fetchAppointmentAvailability } from '../../../services/api/appointments';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import { fetchPatients } from '../../../services/api/patients';
import { formatFullName, formatTime } from '../../../utils/formatters';
import { nowHHMM, todayIso } from '../../../utils/dates';
import { ROUTES } from '../../../constants/routes';
import type { Patient } from '../../../types';

interface Confirmation {
  patientName: string;
  doctorName: string;
  time: string;
}

export function WalkInPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  // The backend only lets Receptionists create appointments.
  const canBook = currentUser?.role === 'Receptionist';

  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState(''); // '' = first available
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const matches = useAsync(
    () =>
      debouncedQuery.trim() === '' || patient
        ? Promise.resolve(null)
        : fetchPatients({ search: debouncedQuery, pageSize: 6 }),
    [debouncedQuery, patient],
  );
  const doctors = useAsync(
    () => fetchDoctorOptions({ branchId: currentUser?.branchId }),
    [currentUser?.branchId],
  );

  const doctorOptions = [
    { label: 'First Available', value: '' },
    ...(doctors.data ?? []).map((d) => ({
      label: `Dr. ${d.doctorName}${d.specialties.length ? ` (${d.specialties.join(', ')})` : ''}`,
      value: String(d.staffId),
    })),
  ];

  /** Earliest free slot today (from now on) for the chosen doctor, or across all doctors. */
  async function findSlot(): Promise<{ staffId: number; doctorName: string; time: string } | null> {
    const date = todayIso();
    const now = nowHHMM();
    const candidates = (doctors.data ?? []).filter(
      (d) => doctorId === '' || String(d.staffId) === doctorId,
    );

    let best: { staffId: number; doctorName: string; time: string } | null = null;
    for (const doctor of candidates) {
      const slots = await fetchAppointmentAvailability(doctor.staffId, date);
      const next = slots.find((slot) => slot.available && slot.time >= now);
      if (next && (best === null || next.time < best.time)) {
        best = { staffId: doctor.staffId, doctorName: doctor.doctorName, time: next.time };
      }
    }
    return best;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patient || !currentUser) return;
    setSubmitting(true);
    setError(null);
    try {
      const slot = await findSlot();
      if (!slot) {
        setError('No free slots left today for the selected doctor(s).');
        return;
      }
      await bookAppointment({
        patientId: patient.patientId,
        doctorStaffId: slot.staffId,
        branchId: currentUser.branchId,
        appointmentDate: todayIso(),
        appointmentTime: slot.time,
        isWalkIn: true,
      });
      setConfirmation({
        patientName: formatFullName(patient.firstName, patient.lastName),
        doctorName: slot.doctorName,
        time: slot.time,
      });
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setError('That slot was just taken by another booking. Please try again.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not register the walk-in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setConfirmation(null);
    setPatient(null);
    setPatientQuery('');
    setDoctorId('');
    setError(null);
  }

  if (confirmation) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 pt-4 sm:pt-8">
        <div className="relative isolate w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-6 shadow-elevated sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
          <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated">
            <Icon name="check_circle" filled size={32} />
          </div>
          <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Check-in complete</p>
          <h2 className="mt-1 text-display-sm text-white">Walk-In Registered</h2>
          <p className="mb-6 mt-2 text-body-md text-white/80">
            {confirmation.patientName} was added to today&apos;s schedule.
          </p>
          <div className="mb-6 w-full rounded-xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
            <p className="mb-2 text-label-md uppercase tracking-wider text-white/75">Appointment Time</p>
            <div className="mb-1 text-display-sm text-white">{formatTime(confirmation.time)}</div>
            <div className="flex items-center justify-center gap-2 text-body-md text-white/85">
              <Icon name="stethoscope" size={18} />
              Dr. {confirmation.doctorName}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:flex-1"
              onClick={handleReset}
            >
              Register Another
            </Button>
            <Button
              variant="primary"
              className="w-full bg-white text-primary shadow-lg hover:bg-primary-fixed sm:flex-1"
              onClick={() => navigate(ROUTES.APPOINTMENTS)}
            >
              View Schedule
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-2 sm:pt-4">
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated">
            <Icon name="how_to_reg" size={26} />
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Reception</p>
            <h1 className="text-display-sm text-white">New Walk-In</h1>
            <p className="mt-1 text-body-sm text-white/80">Register an unscheduled arrival.</p>
          </div>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <Icon name="person_search" size={20} />
            </span>
            <div>
              <h2 className="text-headline-sm text-on-surface">Patient check-in</h2>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">Find the patient and choose a provider.</p>
            </div>
          </div>

          {!canBook && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-tertiary/30 bg-tertiary/10 p-3 text-body-sm text-on-surface">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-tertiary" />
            Only receptionists can register walk-ins.
          </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1 relative">
            {!patient ? (
              <>
                <Input
                  label="Patient"
                  icon="search"
                  placeholder="Search by name, NIC, or phone..."
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                />
                {matches.data && (
                  <div className="absolute z-20 top-full mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
                    {matches.data.items.length === 0 && (
                      <div className="px-4 py-3 text-body-sm text-on-surface-variant">No patients found.</div>
                    )}
                    {matches.data.items.map((p) => (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => {
                          setPatient(p);
                          setPatientQuery('');
                        }}
                        className="w-full px-4 py-3 text-left text-body-sm text-on-surface transition-colors hover:bg-primary-fixed/20 focus-visible:bg-primary-fixed/20 focus-visible:outline-none"
                      >
                        {formatFullName(p.firstName, p.lastName)}
                        <span className="ml-2 font-mono text-xs text-on-surface-variant">{p.nicPassportNo}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.PATIENTS)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-label-md font-medium text-primary hover:bg-primary-fixed/30 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon name="add" size={14} />
                    New Patient
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-label-md text-on-surface-variant">Patient</span>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 p-4">
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {formatFullName(patient.firstName, patient.lastName)}
                    </div>
                    <div className="text-label-md text-on-surface-variant">NIC: {patient.nicPassportNo}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPatient(null)}
                    className="text-error text-label-md hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>

          <Select
            label="Assign To (Current Branch)"
            options={doctorOptions}
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
          />

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/50 p-3 text-body-sm text-on-error-container">
              <Icon name="error" size={18} className="shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            icon={isSubmitting ? undefined : 'how_to_reg'}
            isLoading={isSubmitting}
            disabled={!canBook || !patient || doctors.isLoading || isSubmitting}
            className="mt-2 w-full shadow-elevated"
            size="md"
          >
            {isSubmitting ? 'Booking...' : 'Book Walk-In'}
          </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
