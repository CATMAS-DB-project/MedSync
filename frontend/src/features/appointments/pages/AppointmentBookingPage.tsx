import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import type { SelectOption } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { bookAppointment, fetchAppointmentAvailability } from '../../../services/api/appointments';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import type { DoctorOption } from '../../../services/api/doctorOptions';
import { fetchSpecialties } from '../../../services/api/specialties';
import { ROUTES } from '../../../constants/routes';
import { toIsoDate, todayIso } from '../../../utils/dates';
import { formatFullName } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import { PatientPicker } from '../components/PatientPicker';
import { DoctorCard } from '../components/DoctorCard';
import { SlotGrid } from '../components/SlotGrid';
import { BookingSummaryCard } from '../components/BookingSummaryCard';
import { BookingSuccess } from '../components/BookingSuccess';
import { DateStrip } from '../components/DateStrip';
import type { AvailabilitySlot, Patient } from '../../../types';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return toIsoDate(date);
}

function buildNext14Days(): string[] {
  const today = todayIso();
  return Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
}

interface NumberedCardProps {
  number: number;
  title: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

function NumberedCard({
  number,
  title,
  disabled = false,
  className,
  children,
}: NumberedCardProps) {
  return (
    <Card padding="none" className={cn('relative', className)}>
      <header className="flex items-center gap-3 rounded-t-2xl border-b border-outline-variant px-4 py-3 sm:px-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
          {number}
        </span>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
      </header>
      <div className={cn('p-4 sm:p-5', disabled && 'pointer-events-none opacity-50 select-none')}>
        {children}
      </div>
    </Card>
  );
}

export function AppointmentBookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const toast = useToast();

  const isReceptionist = currentUser?.role === 'Receptionist';

  const preselectedId = useMemo(() => {
    const raw = searchParams.get('patientId');
    if (!raw) return null;
    const id = Number(raw);
    return Number.isNaN(id) ? null : id;
  }, [searchParams]);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [specialtyId, setSpecialtyId] = useState('all');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedSummary, setBookedSummary] = useState<{
    patientName: string;
    doctorName: string;
    branchName: string;
    date: string;
    time: string;
    fee: number;
  } | null>(null);

  const specialties = useAsync(
    () => (isReceptionist ? fetchSpecialties(1, 100) : Promise.resolve(null)),
    [isReceptionist],
  );

  const doctors = useAsync<DoctorOption[]>(
    () =>
      !isReceptionist || !currentUser
        ? Promise.resolve([])
        : fetchDoctorOptions({
            branchId: currentUser.branchId,
            specialtyId: specialtyId === 'all' ? undefined : Number(specialtyId),
          }),
    [isReceptionist, currentUser?.branchId, specialtyId],
  );

  const availability = useAsync<AvailabilitySlot[]>(
    () =>
      selectedDoctorId === null
        ? Promise.resolve([])
        : fetchAppointmentAvailability(Number(selectedDoctorId), selectedDate),
    [selectedDoctorId, selectedDate],
  );

  useEffect(() => {
    if (!selectedDoctorId || !doctors.data) return;
    const stillPresent = doctors.data.some((d) => String(d.staffId) === selectedDoctorId);
    if (!stillPresent) {
      setSelectedDoctorId(null);
      setSelectedTime(null);
    }
  }, [doctors.data, selectedDoctorId]);

  const doctorList = doctors.data ?? [];
  const selectedDoctor = useMemo(
    () => doctorList.find((d) => String(d.staffId) === selectedDoctorId) ?? null,
    [doctorList, selectedDoctorId],
  );

  const specialtyOptions: SelectOption[] = useMemo(
    () => [
      { label: 'All specialties', value: 'all' },
      ...(specialties.data?.items ?? []).map((s) => ({
        label: s.specialtyName,
        value: String(s.specialtyId),
      })),
    ],
    [specialties.data],
  );

  const next14 = useMemo(() => buildNext14Days(), []);
  const today = todayIso();

  const canConfirm =
    selectedPatient !== null && selectedDoctor !== null && selectedTime !== null && !isSubmitting;

  const isPatientComplete = selectedPatient !== null;
  const isDoctorComplete = selectedDoctor !== null;

  const resetForm = () => {
    setSelectedPatient(null);
    setSpecialtyId('all');
    setSelectedDoctorId(null);
    setSelectedDate(todayIso());
    setSelectedTime(null);
    setSubmitError(null);
    setIsSuccess(false);
    setBookedSummary(null);
  };

  const handleConfirm = async () => {
    if (!canConfirm || !currentUser || !selectedPatient || !selectedDoctor || !selectedTime) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await bookAppointment({
        patientId: selectedPatient.patientId,
        doctorStaffId: selectedDoctor.staffId,
        branchId: currentUser.branchId,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
      });
      setBookedSummary({
        patientName: formatFullName(selectedPatient.firstName, selectedPatient.lastName),
        doctorName: selectedDoctor.doctorName,
        branchName: currentUser.branchName,
        date: selectedDate,
        time: selectedTime,
        fee: selectedDoctor.consultationFee,
      });
      setIsSuccess(true);
      toast.success('Appointment booked');
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setSubmitError('That slot was just taken. Pick another time.');
        setSelectedTime(null);
        availability.reload();
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Could not book the appointment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReceptionist || !currentUser) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Only receptionists can book appointments" />
      </div>
    );
  }

  if (isSuccess && bookedSummary) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-24 md:pb-0">
        <PageHeader title="Book appointment" backTo={ROUTES.APPOINTMENTS} />
        <BookingSuccess
          {...bookedSummary}
          onBookAnother={resetForm}
          onViewAppointments={() =>
            navigate(
              `${ROUTES.APPOINTMENTS}?date=${bookedSummary.date}&branchId=${currentUser.branchId}`,
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-24 md:pb-0">
      <PageHeader title="Book appointment" backTo={ROUTES.APPOINTMENTS} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <NumberedCard number={1} title="Patient" className="z-20">
            <PatientPicker
              value={selectedPatient}
              onChange={(next) => {
                setSelectedPatient(next);
                setSubmitError(null);
              }}
              initialPatientId={preselectedId}
            />
          </NumberedCard>

          <NumberedCard number={2} title="Doctor" disabled={!isPatientComplete} className="z-10">
            <div className="flex flex-col gap-4">
              <Select
                label="Specialty"
                value={specialtyId}
                onChange={(event) => {
                  setSpecialtyId(event.target.value);
                  setSelectedTime(null);
                }}
                options={specialtyOptions}
              />

              {doctors.error ? (
                <ErrorBanner message={doctors.error} onRetry={doctors.reload} />
              ) : doctors.isLoading && doctorList.length === 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} height={140} rounded="xl" />
                  ))}
                </div>
              ) : doctorList.length === 0 ? (
                <EmptyState icon="medical_services" title="No doctors found" />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {doctorList.map((doctor) => (
                    <DoctorCard
                      key={doctor.staffId}
                      doctor={doctor}
                      selected={selectedDoctorId === String(doctor.staffId)}
                      onSelect={() => {
                        setSelectedDoctorId(String(doctor.staffId));
                        setSelectedTime(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </NumberedCard>

          <NumberedCard
            number={3}
            title="Date & time"
            disabled={!isPatientComplete || !isDoctorComplete}
            className="z-0"
          >
            <div className="flex flex-col gap-4">
              <DateStrip
                days={next14}
                value={selectedDate}
                onChange={(iso) => {
                  setSelectedDate(iso);
                  setSelectedTime(null);
                }}
                today={today}
                minDate={today}
              />

              <div className="max-w-xs">
                <label className="text-label-md font-medium text-on-surface">
                  Jump to date
                  <input
                    type="date"
                    value={selectedDate}
                    min={today}
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedDate(event.target.value);
                        setSelectedTime(null);
                      }
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              {selectedDoctor === null ? (
                <p className="text-body-sm text-on-surface-variant">
                  Pick a doctor to see times.
                </p>
              ) : (
                <SlotGrid
                  slots={availability.data ?? []}
                  loading={availability.isLoading}
                  error={availability.error}
                  onRetry={availability.reload}
                  selectedTime={selectedTime}
                  onSelect={setSelectedTime}
                  date={selectedDate}
                />
              )}
            </div>
          </NumberedCard>

          {submitError && <ErrorBanner message={submitError} />}
        </div>

        <aside className="hidden lg:col-span-1 lg:block">
          <div className="sticky top-4">
            <BookingSummaryCard
              patientName={
                selectedPatient
                  ? formatFullName(selectedPatient.firstName, selectedPatient.lastName)
                  : null
              }
              doctorName={selectedDoctor?.doctorName ?? null}
              branchName={currentUser.branchName}
              date={selectedDate}
              time={selectedTime}
              fee={selectedDoctor?.consultationFee ?? null}
              onConfirm={handleConfirm}
              isPending={isSubmitting}
              disabled={!canConfirm}
            />
          </div>
        </aside>

        <div className="lg:hidden">
          <BookingSummaryCard
            patientName={
              selectedPatient
                ? formatFullName(selectedPatient.firstName, selectedPatient.lastName)
                : null
            }
            doctorName={selectedDoctor?.doctorName ?? null}
            branchName={currentUser.branchName}
            date={selectedDate}
            time={selectedTime}
            fee={selectedDoctor?.consultationFee ?? null}
            onConfirm={handleConfirm}
            isPending={isSubmitting}
            disabled={!canConfirm}
            showConfirm={false}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-outline-variant bg-surface-container-lowest/95 p-3 backdrop-blur lg:hidden">
        <Button
          variant="primary"
          className="w-full"
          isLoading={isSubmitting}
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          Confirm booking
        </Button>
      </div>
    </div>
  );
}
