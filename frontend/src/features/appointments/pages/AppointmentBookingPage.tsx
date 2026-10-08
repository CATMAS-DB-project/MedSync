import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Toggle } from '../../../components/ui/Toggle';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ApiError } from '../../../services/api/ApiError';
import { bookAppointment, fetchAppointmentAvailability } from '../../../services/api/appointments';
import { fetchBranches } from '../../../services/api/branches';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import { fetchPatientById, fetchPatients } from '../../../services/api/patients';
import { fetchSpecialties } from '../../../services/api/specialties';
import { formatDate, formatFullName, formatTime, getInitials } from '../../../utils/formatters';
import { nowHHMM, toIsoDate, todayIso } from '../../../utils/dates';
import { ROUTES } from '../../../constants/routes';
import type { Patient } from '../../../types';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = Array.from({ length: firstDay }, () => null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

function hourLabel(time: string): string {
  return formatTime(`${time.slice(0, 2)}:00`);
}

export function AppointmentBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const today = todayIso();

  // Patient
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Provider
  const [branchId, setBranchId] = useState(currentUser ? String(currentUser.branchId) : '');
  const [specialtyId, setSpecialtyId] = useState('all');
  const [doctorId, setDoctorId] = useState('');

  // When
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Submit
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Arriving from the patient drawer ("Book Appointment") pre-selects that patient.
  const preselectedId = (location.state as { patientId?: number } | null)?.patientId;
  useEffect(() => {
    if (preselectedId === undefined) return;
    fetchPatientById(preselectedId)
      .then(setSelectedPatient)
      .catch(() => undefined);
  }, [preselectedId]);

  const patientMatches = useAsync(
    () =>
      debouncedQuery.trim() === '' || selectedPatient
        ? Promise.resolve(null)
        : fetchPatients({ search: debouncedQuery, pageSize: 8 }),
    [debouncedQuery, selectedPatient],
  );
  const branches = useAsync(() => fetchBranches(1, 100), []);
  const specialties = useAsync(() => fetchSpecialties(1, 100), []);
  const doctors = useAsync(
    () =>
      fetchDoctorOptions({
        branchId: branchId ? Number(branchId) : undefined,
        specialtyId: specialtyId === 'all' ? undefined : Number(specialtyId),
      }),
    [branchId, specialtyId],
  );

  // Forget the chosen doctor if the filters no longer include them.
  useEffect(() => {
    if (doctorId && doctors.data && !doctors.data.some((d) => String(d.staffId) === doctorId)) {
      setDoctorId('');
      setSelectedTime(null);
    }
  }, [doctors.data, doctorId]);

  const availability = useAsync(
    () =>
      doctorId ? fetchAppointmentAvailability(Number(doctorId), selectedDate) : Promise.resolve([]),
    [doctorId, selectedDate],
  );

  const effectiveDate = isWalkIn ? today : selectedDate;
  useEffect(() => {
    if (isWalkIn) {
      setSelectedDate(today);
      setMonthOffset(0);
      setSelectedTime(null);
    }
  }, [isWalkIn, today]);

  const viewDate = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
  const calendarDays = useMemo(
    () => buildCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthOffset],
  );
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const slotGroups = useMemo(() => {
    const groups = new Map<string, { time: string; available: boolean }[]>();
    for (const slot of availability.data ?? []) {
      const label = hourLabel(slot.time);
      groups.set(label, [...(groups.get(label) ?? []), slot]);
    }
    return Array.from(groups.entries());
  }, [availability.data]);

  const branchOptions = (branches.data?.items ?? []).map((b) => ({
    label: b.branchName,
    value: String(b.branchId),
  }));
  const specialtyOptions = [
    { label: 'All Specialties', value: 'all' },
    ...(specialties.data?.items ?? []).map((s) => ({
      label: s.specialtyName,
      value: String(s.specialtyId),
    })),
  ];
  const doctorOptions = (doctors.data ?? []).map((d) => ({
    label: `Dr. ${d.doctorName}${d.specialties.length ? ` (${d.specialties.join(', ')})` : ''}`,
    value: String(d.staffId),
  }));

  const canSubmit =
    selectedPatient !== null && doctorId !== '' && branchId !== '' && selectedTime !== null && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit || !selectedPatient || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bookAppointment({
        patientId: selectedPatient.patientId,
        doctorStaffId: Number(doctorId),
        branchId: Number(branchId),
        appointmentDate: effectiveDate,
        appointmentTime: selectedTime,
        isWalkIn,
      });
      navigate(ROUTES.APPOINTMENTS);
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // The overlap rule rejected it: someone took that slot first.
        setSubmitError('That time slot was just taken. Please pick another one.');
        setSelectedTime(null);
        availability.reload();
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Could not book the appointment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const nowTime = nowHHMM();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-display-sm text-on-surface mb-1">Book Appointment</h1>
          <p className="text-body-md text-on-surface-variant">Schedule a patient visit or consultation.</p>
        </div>
        <Toggle checked={isWalkIn} onChange={setIsWalkIn} label="Walk-in" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-element-gap">
        <div className="lg:col-span-5 flex flex-col gap-element-gap">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-4">Patient Information</h3>
            {!selectedPatient ? (
              <div className="relative">
                <Input
                  label="Search Patient"
                  icon="search"
                  placeholder="Name, NIC, or phone..."
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                />
                {patientMatches.data && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded shadow-elevated max-h-48 overflow-y-auto">
                    {patientMatches.data.items.length === 0 && (
                      <div className="px-3 py-2 text-body-sm text-on-surface-variant">No patients found.</div>
                    )}
                    {patientMatches.data.items.map((patient) => (
                      <button
                        key={patient.patientId}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container-low flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[10px] font-bold">
                          {getInitials(formatFullName(patient.firstName, patient.lastName))}
                        </div>
                        <span className="text-body-sm text-on-surface">
                          {formatFullName(patient.firstName, patient.lastName)}
                          <span className="ml-2 font-mono text-xs text-on-surface-variant">
                            {patient.nicPassportNo}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-label-md">
                    {getInitials(formatFullName(selectedPatient.firstName, selectedPatient.lastName))}
                  </div>
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {formatFullName(selectedPatient.firstName, selectedPatient.lastName)}
                    </div>
                    <div className="text-label-md text-outline">NIC: {selectedPatient.nicPassportNo}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-error text-label-md hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm flex-1">
            <h3 className="text-headline-sm text-on-surface mb-4">Provider</h3>
            <div className="flex flex-col gap-4">
              <Select
                label="Branch"
                options={branchOptions}
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setDoctorId('');
                  setSelectedTime(null);
                }}
              />
              <Select
                label="Specialty"
                options={specialtyOptions}
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
              />
              <Select
                label="Doctor"
                placeholder={doctors.isLoading ? 'Loading doctors…' : 'Select a doctor'}
                options={doctorOptions}
                value={doctorId}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setSelectedTime(null);
                }}
              />
              {!doctors.isLoading && doctorOptions.length === 0 && (
                <p className="text-body-sm text-on-surface-variant">No doctors match this branch and specialty.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-element-gap">
          <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm h-full flex flex-col">
            <div className="mb-6 pb-6 border-b border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface">Select Date</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isWalkIn || monthOffset === 0}
                    onClick={() => setMonthOffset((m) => m - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant disabled:opacity-40"
                  >
                    <Icon name="chevron_left" size={18} />
                  </button>
                  <span className="text-body-md font-medium flex items-center">{monthLabel}</span>
                  <button
                    type="button"
                    disabled={isWalkIn}
                    onClick={() => setMonthOffset((m) => m + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container-low text-on-surface-variant disabled:opacity-40"
                  >
                    <Icon name="chevron_right" size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="text-label-md text-outline">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((day, index) => {
                  if (day === null) return <div key={index} />;
                  const iso = toIsoDate(day);
                  const isPast = iso < today;
                  const disabled = isPast || (isWalkIn && iso !== today);
                  const isSelected = iso === effectiveDate;
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(iso);
                        setSelectedTime(null);
                      }}
                      className={`py-1 text-body-md rounded ${
                        disabled
                          ? 'text-outline cursor-not-allowed'
                          : isSelected
                            ? 'bg-primary-container text-on-primary-container font-medium'
                            : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-headline-sm text-on-surface">Available Slots</h3>
                <span className="text-label-md text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                  {formatDate(effectiveDate)}
                </span>
              </div>

              {!doctorId && (
                <p className="text-body-sm text-on-surface-variant">Select a doctor to see available times.</p>
              )}
              {doctorId && availability.isLoading && (
                <p className="text-body-sm text-on-surface-variant">Loading slots…</p>
              )}
              {availability.error && (
                <p className="text-body-sm text-error">
                  {availability.error}{' '}
                  <button type="button" className="underline" onClick={availability.reload}>
                    Retry
                  </button>
                </p>
              )}

              <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-2 max-h-[300px]">
                {slotGroups.map(([label, slots]) => (
                  <div key={label} className="col-span-4">
                    <div className="text-label-md text-outline mt-2 mb-1">{label}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((slot) => {
                        const inPast = effectiveDate === today && slot.time < nowTime;
                        const unavailable = !slot.available || (inPast && !isWalkIn);
                        const isSelected = selectedTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={unavailable}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2 rounded text-body-md border transition-colors ${
                              unavailable
                                ? 'bg-surface-container-low border-outline-variant text-outline cursor-not-allowed opacity-60'
                                : isSelected
                                  ? 'bg-primary border-primary text-on-primary font-medium shadow-sm'
                                  : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:border-primary'
                            }`}
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mt-4 rounded border border-error/40 bg-error/10 p-3 text-body-sm text-error">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => navigate(ROUTES.APPOINTMENTS)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" icon="event_available" disabled={!canSubmit} onClick={handleSubmit}>
          {isSubmitting ? 'Booking…' : 'Confirm Booking'}
        </Button>
      </div>
    </div>
  );
}
