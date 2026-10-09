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
      <div className="flex justify-center items-start pt-8">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-lg p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-6">
            <Icon name="check_circle" filled className="text-secondary" size={32} />
          </div>
          <h2 className="text-headline-sm text-on-surface mb-2">Walk-In Registered</h2>
          <p className="text-body-md text-on-surface-variant mb-6">
            {confirmation.patientName} was added to today&apos;s schedule.
          </p>
          <div className="bg-surface-container-low w-full p-6 rounded border border-outline-variant mb-8">
            <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Appointment Time</p>
            <div className="text-display-sm text-primary mb-1">{formatTime(confirmation.time)}</div>
            <div className="text-body-md text-on-surface flex items-center justify-center gap-2">
              <Icon name="stethoscope" size={18} />
              Dr. {confirmation.doctorName}
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={handleReset}>
              Register Another
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => navigate(ROUTES.APPOINTMENTS)}>
              View Schedule
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start pt-8">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
        <div className="mb-6 border-b border-outline-variant pb-4">
          <h1 className="text-headline-sm text-on-surface">New Walk-In</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">Register an unscheduled arrival.</p>
        </div>

        {!canBook && (
          <div className="mb-4 rounded border border-tertiary/40 bg-tertiary/10 p-3 text-body-sm text-on-surface">
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
                  <div className="absolute z-10 top-full mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded shadow-elevated max-h-48 overflow-y-auto">
                    {matches.data.items.length === 0 && (
                      <div className="px-3 py-2 text-body-sm text-on-surface-variant">No patients found.</div>
                    )}
                    {matches.data.items.map((p) => (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => {
                          setPatient(p);
                          setPatientQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container-low text-body-sm text-on-surface"
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
                    className="text-primary text-label-md hover:underline flex items-center gap-1"
                  >
                    <Icon name="add" size={14} />
                    New Patient
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-label-md text-on-surface-variant">Patient</span>
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant flex items-center justify-between">
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {formatFullName(patient.firstName, patient.lastName)}
                    </div>
                    <div className="text-label-md text-outline">NIC: {patient.nicPassportNo}</div>
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

          {error && <p className="text-body-sm text-error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            icon={isSubmitting ? undefined : 'how_to_reg'}
            isLoading={isSubmitting}
            disabled={!canBook || !patient || doctors.isLoading || isSubmitting}
            className="w-full mt-4"
            size="md"
          >
            {isSubmitting ? 'Booking...' : 'Book Walk-In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
