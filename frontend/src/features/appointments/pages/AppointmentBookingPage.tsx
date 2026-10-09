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
import { formatFullName, formatTime, getInitials } from '../../../utils/formatters';
import { toIsoDate, todayIso } from '../../../utils/dates';
import { ROUTES } from '../../../constants/routes';
import { useToast } from '../../../components/common/ToastProvider';
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
  const toast = useToast();
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
      toast.success('Appointment booked successfully.');
      navigate(ROUTES.APPOINTMENTS);
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setSubmitError('That time slot was just taken. Please pick another one.');
        setSelectedTime(null);
        availability.reload();
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
        toast.error(err.message);
      } else {
        setSubmitError('Could not book the appointment. Please try again.');
        toast.error('Could not book the appointment. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

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
                placeholder="Select branch"
                options={branchOptions}
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              />
              <Select
                label="Specialty"
                placeholder="All specialties"
                options={specialtyOptions}
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
              />
              <Select
                label="Doctor"
                placeholder="Select a doctor"
                options={doctorOptions}
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                disabled={doctorOptions.length === 0}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-sm text-on-surface">Schedule</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((prev) => prev - 1)}>
                  <Icon name="chevron_left" size={18} />
                </Button>
                <span className="text-body-sm text-on-surface-variant">{monthLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((prev) => prev + 1)}>
                  <Icon name="chevron_right" size={18} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-label-md text-on-surface-variant">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-16 rounded border border-transparent" />;
                }

                const iso = toIsoDate(day);
                const isSelected = iso === selectedDate;
                const isPast = iso < today;
                const isAvailable = availability.data?.some((slot) => slot.available) ?? false;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => !isPast && setSelectedDate(iso)}
                    disabled={isPast}
                    className={[
                      'h-16 rounded border text-left p-2 transition-colors',
                      isSelected ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant bg-surface-container-low text-on-surface',
                      isPast ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container-high',
                    ].join(' ')}
                  >
                    <div className="text-label-md font-medium">{day.getDate()}</div>
                    {isAvailable && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500" />}
                  </button>
                );
              })}
            </div>

            {submitError && (
              <div className="mt-4 rounded border border-error/40 bg-error/10 p-3 text-body-sm text-error">
                {submitError}
              </div>
            )}

            {doctorId && availability.isLoading && (
              <div className="mt-4 text-body-sm text-on-surface-variant">Loading slots…</div>
            )}

            {doctorId && availability.data && slotGroups.length > 0 && (
              <div className="mt-4 space-y-3">
                {slotGroups.map(([label, slots]) => {
                  return (
                    <div key={label} className="rounded border border-outline-variant bg-surface-container-low p-3">
                      <div className="mb-2 text-label-md text-on-surface-variant">{label}</div>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => {
                          const active = selectedTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                              className={[
                                'rounded px-3 py-1.5 text-label-md transition-colors',
                                slot.available
                                  ? active
                                    ? 'bg-primary-container text-on-primary-container'
                                    : 'bg-surface text-on-surface hover:bg-surface-container-high'
                                  : 'bg-surface-container-low text-on-surface-variant cursor-not-allowed',
                            ].join(' ')}
                            >
                              {slot.available ? 'Available' : 'Booked'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {doctorId && !availability.isLoading && availability.data && slotGroups.length === 0 && (
              <div className="mt-4 rounded border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
                No available slots for this date.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate(ROUTES.APPOINTMENTS)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} isLoading={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Confirm Appointment'}
        </Button>
      </div>
    </div>
  );
}
