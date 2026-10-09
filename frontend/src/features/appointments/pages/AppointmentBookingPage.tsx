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
    <div className="mx-auto w-full max-w-6xl">
      <div className="relative isolate mb-6 flex flex-col justify-between gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 shadow-elevated sm:flex-row sm:items-center sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 z-0 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-elevated">
            <Icon name="event_available" size={26} />
          </div>
          <div>
            <p className="text-label-md font-semibold uppercase tracking-[0.16em] text-white/75">Care coordination</p>
            <h1 className="text-display-sm text-white">Book Appointment</h1>
            <p className="mt-1 text-body-sm text-white/80">Schedule a patient visit or consultation.</p>
          </div>
        </div>
        <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
          <Toggle checked={isWalkIn} onChange={setIsWalkIn} label="Walk-in" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-5">
          <section className="relative rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated sm:p-5">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-primary to-secondary" />
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <Icon name="person_search" size={20} />
              </span>
              <h3 className="text-headline-sm text-on-surface">Patient Information</h3>
            </div>
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
                  <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
                    {patientMatches.data.items.length === 0 && (
                      <div className="px-4 py-3 text-body-sm text-on-surface-variant">No patients found.</div>
                    )}
                    {patientMatches.data.items.map((patient) => (
                      <button
                        key={patient.patientId}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientQuery('');
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-fixed/20 focus-visible:bg-primary-fixed/20 focus-visible:outline-none"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-label-md font-bold text-on-secondary-fixed">
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
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-label-md font-bold text-primary">
                    {getInitials(formatFullName(selectedPatient.firstName, selectedPatient.lastName))}
                  </div>
                  <div>
                    <div className="text-body-md font-medium text-on-surface">
                      {formatFullName(selectedPatient.firstName, selectedPatient.lastName)}
                    </div>
                    <div className="text-label-md text-on-surface-variant">NIC: {selectedPatient.nicPassportNo}</div>
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
          </section>

          <section className="relative flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-elevated sm:p-5">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-secondary to-primary" />
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-fixed/70 text-secondary">
                <Icon name="medical_services" size={20} />
              </span>
              <h3 className="text-headline-sm text-on-surface">Provider</h3>
            </div>
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
          </section>
        </div>

        <div className="lg:col-span-7">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-gradient-to-r from-primary-fixed/30 to-secondary-fixed/20 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                  <Icon name="calendar_month" size={20} />
                </span>
                <div>
                  <h3 className="text-headline-sm text-on-surface">Schedule</h3>
                  <p className="text-body-sm text-on-surface-variant">Select a date and available time.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((prev) => prev - 1)}>
                  <Icon name="chevron_left" size={18} />
                </Button>
                <span className="min-w-32 text-center text-body-sm font-semibold text-on-surface">{monthLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((prev) => prev + 1)}>
                  <Icon name="chevron_right" size={18} />
                </Button>
              </div>
            </div>

            <div className="px-4 pt-4 sm:px-5">
            <div className="mb-3 grid grid-cols-7 gap-1.5 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-center text-label-md font-semibold text-on-surface-variant">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square rounded-lg border border-transparent sm:aspect-auto sm:h-16" />;
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
                      'relative flex aspect-square flex-col rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:aspect-auto sm:h-16 sm:p-2',
                      isSelected ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-outline-variant bg-surface-container-lowest text-on-surface',
                      isPast ? 'cursor-not-allowed opacity-40' : 'hover:border-primary/40 hover:bg-primary-fixed/20',
                    ].join(' ')}
                  >
                    <div className="text-label-md font-semibold">{day.getDate()}</div>
                    {isAvailable && <div className={`mt-auto h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-secondary'}`} />}
                  </button>
                );
              })}
            </div>
            </div>

            {submitError && (
              <div role="alert" className="mx-4 mt-4 rounded-lg border border-error/30 bg-error-container/50 p-3 text-body-sm text-on-error-container sm:mx-5">
                {submitError}
              </div>
            )}

            {doctorId && availability.isLoading && (
              <div role="status" className="mx-4 mt-4 inline-flex items-center gap-2 text-body-sm text-on-surface-variant sm:mx-5">
                <Icon name="progress_activity" size={18} className="animate-spin text-primary" />
                Loading slots…
              </div>
            )}

            {doctorId && availability.data && slotGroups.length > 0 && (
              <div className="space-y-3 px-4 pb-5 pt-4 sm:px-5">
                {slotGroups.map(([label, slots]) => {
                  return (
                    <div key={label} className="rounded-xl border border-outline-variant bg-surface-container-low/70 p-3">
                      <div className="mb-2 flex items-center gap-2 text-label-md font-semibold text-on-surface-variant">
                        <Icon name="schedule" size={16} />
                        {label}
                      </div>
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
                                'rounded-lg px-3 py-2 text-label-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                slot.available
                                  ? active
                                    ? 'bg-primary text-on-primary shadow-sm'
                                    : 'bg-surface-container-lowest text-on-surface hover:bg-primary-fixed/30'
                                  : 'cursor-not-allowed bg-surface-container-low text-on-surface-variant',
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
              <div className="mx-4 mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant sm:mx-5">
                No available slots for this date.
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="sticky bottom-16 z-20 mt-2 flex flex-col-reverse gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest/95 p-3 shadow-elevated backdrop-blur md:bottom-4 md:flex-row md:justify-end md:gap-3">
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
