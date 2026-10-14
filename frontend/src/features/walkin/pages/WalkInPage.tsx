import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import {
  bookAppointment,
  fetchAppointmentAvailability,
  fetchAppointments,
} from '../../../services/api/appointments';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import type { DoctorOption } from '../../../services/api/doctorOptions';
import { ROUTES } from '../../../constants/routes';
import { nowHHMM, todayIso } from '../../../utils/dates';
import { formatCurrency, formatFullName, formatTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';
import { PatientPicker } from '../../appointments/components/PatientPicker';
import { DoctorCard } from '../../appointments/components/DoctorCard';
import { BookingSuccess } from '../../appointments/components/BookingSuccess';
import { RescheduleAppointmentDrawer } from '../../appointments/components/RescheduleAppointmentDrawer';
import type { Appointment, AvailabilitySlot, Patient } from '../../../types';

interface SuccessState {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  fee: number;
}

export function WalkInPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const today = todayIso();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotToConfirm, setSlotToConfirm] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  // Doctors for the receptionist's branch
  const doctors = useAsync<DoctorOption[]>(
    () =>
      isReceptionist && currentUser
        ? fetchDoctorOptions({ branchId: currentUser.branchId })
        : Promise.resolve([]),
    [isReceptionist, currentUser?.branchId],
  );

  const doctorList = doctors.data ?? [];
  const selectedDoctor = useMemo(
    () => doctorList.find((d) => d.staffId === selectedDoctorId) ?? null,
    [doctorList, selectedDoctorId],
  );

  // Today's schedule data: live availability slots + booked appointments
  const scheduleData = useAsync(
    async () => {
      if (!selectedDoctorId || !currentUser?.branchId) {
        return { availability: [] as AvailabilitySlot[], appointments: [] as Appointment[] };
      }
      const [availability, appointments] = await Promise.all([
        fetchAppointmentAvailability(selectedDoctorId, today),
        fetchAppointments({
          branchId: currentUser.branchId,
          doctorId: selectedDoctorId,
          date: today,
          pageSize: 100,
        }),
      ]);
      return { availability, appointments: appointments.items };
    },
    [selectedDoctorId, currentUser?.branchId, today],
  );

  // Reset selected slot when doctor changes
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDoctorId]);

  // Merge today's availability with active appointments
  const slotRows = useMemo(() => {
    const rawSlots = scheduleData.data?.availability ?? [];
    const appts = scheduleData.data?.appointments ?? [];
    const apptByTime = new Map<string, Appointment>();

    for (const a of appts) {
      if (a.status !== 'Cancelled') {
        apptByTime.set(a.appointmentTime, a);
      }
    }

    const now = nowHHMM();

    return rawSlots.map((slot) => {
      const occupant = apptByTime.get(slot.time) ?? null;
      const isPast = slot.time <= now;
      const isAvailable = slot.available && occupant === null && !isPast;
      return {
        time: slot.time,
        occupant,
        isPast,
        isAvailable,
      };
    });
  }, [scheduleData.data]);

  const [filter, setFilter] = useState<'all' | 'free' | 'booked'>('all');

  const freeSlotCount = useMemo(
    () => slotRows.filter((s) => s.isAvailable).length,
    [slotRows],
  );

  const bookedSlotCount = useMemo(
    () => slotRows.filter((s) => s.occupant !== null).length,
    [slotRows],
  );

  const filteredSlots = useMemo(() => {
    if (filter === 'free') return slotRows.filter((s) => s.isAvailable);
    if (filter === 'booked') return slotRows.filter((s) => s.occupant !== null);
    return slotRows;
  }, [slotRows, filter]);

  const resetAll = useCallback(() => {
    setSelectedPatient(null);
    setSelectedDoctorId(null);
    setSelectedTime(null);
    setRescheduleTarget(null);
    setFilter('all');
    setError(null);
    setSuccess(null);
  }, []);

  const handleBookWalkIn = useCallback(
    async (timeToBook?: string) => {
      const slotTime = timeToBook ?? selectedTime;
      if (!currentUser || !selectedPatient || !selectedDoctor || !slotTime || isSubmitting) {
        return;
      }
      setIsSubmitting(true);
      setError(null);

      try {
        await bookAppointment({
          patientId: selectedPatient.patientId,
          doctorStaffId: selectedDoctor.staffId,
          branchId: currentUser.branchId,
          appointmentDate: today,
          appointmentTime: slotTime,
          isWalkIn: true,
        });

        setSlotToConfirm(null);
        setSuccess({
          patientName: formatFullName(selectedPatient.firstName, selectedPatient.lastName),
          doctorName: selectedDoctor.doctorName,
          date: today,
          time: slotTime,
          fee: selectedDoctor.consultationFee,
        });
        toast.success('Walk-in appointment booked successfully');
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          setError('That slot was just booked by another user. Pick another slot.');
          setSelectedTime(null);
          setSlotToConfirm(null);
          scheduleData.reload();
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Could not register walk-in. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentUser, selectedPatient, selectedDoctor, selectedTime, isSubmitting, today, toast, scheduleData],
  );

  const handleSlotClick = useCallback(
    (slotTime: string) => {
      setSelectedTime(slotTime);
      if (!selectedPatient) {
        toast.error('Please select a patient first to book this slot');
        return;
      }
      setSlotToConfirm(slotTime);
    },
    [selectedPatient, toast],
  );

  if (!isReceptionist || !currentUser) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-[1400px] items-center justify-center">
        <EmptyState icon="lock" title="Only receptionists can register walk-ins" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Walk-in" backTo={ROUTES.APPOINTMENTS} />
        <BookingSuccess
          title="Walk-in registered"
          patientName={success.patientName}
          doctorName={success.doctorName}
          branchName={currentUser.branchName}
          date={success.date}
          time={success.time}
          fee={success.fee}
          onBookAnother={resetAll}
          onViewAppointments={() =>
            navigate(`${ROUTES.APPOINTMENTS}?date=${success.date}&branchId=${currentUser.branchId}`)
          }
        />
      </div>
    );
  }

  const isDoctorsLoading = doctors.isLoading && doctorList.length === 0;
  const isScheduleLoading = scheduleData.isLoading && scheduleData.data === undefined;
  const canConfirm =
    selectedPatient !== null &&
    selectedDoctor !== null &&
    selectedTime !== null &&
    !isSubmitting;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28 md:pb-8">
      <PageHeader title="Walk-in" backTo={ROUTES.APPOINTMENTS} />

      {/* Step 1: Patient Picker */}
      <Card padding="none" className="relative z-20">
        <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
            1
          </span>
          <h2 className="text-headline-sm text-on-surface">Patient</h2>
        </header>
        <div className="p-4 sm:p-5">
          <PatientPicker
            value={selectedPatient}
            onChange={(next) => {
              setSelectedPatient(next);
              setError(null);
            }}
          />
        </div>
      </Card>

      {/* Step 2: Doctor Selection */}
      <Card padding="none" className="relative z-10">
        <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
            2
          </span>
          <h2 className="text-headline-sm text-on-surface">Doctor</h2>
        </header>
        <div
          className={cn(
            'p-4 sm:p-5',
            selectedPatient === null && 'pointer-events-none opacity-50 select-none',
          )}
        >
          {doctors.error ? (
            <ErrorBanner message={doctors.error} onRetry={doctors.reload} />
          ) : isDoctorsLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} height={120} rounded="xl" />
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
                  selected={selectedDoctorId === doctor.staffId}
                  onSelect={() => {
                    setSelectedDoctorId(doctor.staffId);
                    setError(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Step 3: Today's Full Schedule */}
      <Card padding="none" className="relative z-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
              3
            </span>
            <div className="flex flex-col">
              <h2 className="text-headline-sm text-on-surface">Today&apos;s schedule</h2>
              {selectedDoctor && (
                <span className="text-label-md text-on-surface-variant">
                  {freeSlotCount} free {freeSlotCount === 1 ? 'slot' : 'slots'} available today
                </span>
              )}
            </div>
          </div>
          {selectedDoctor && (
            <div className="flex items-center gap-2">
              <IconButton
                icon={scheduleData.isLoading ? 'progress_activity' : 'refresh'}
                size="sm"
                aria-label="Refresh schedule"
                onClick={scheduleData.reload}
                className={cn(scheduleData.isLoading && 'animate-spin')}
              />
            </div>
          )}
        </header>

        <div
          className={cn(
            'p-4 sm:p-5',
            (selectedPatient === null || selectedDoctor === null) &&
              'pointer-events-none opacity-50 select-none',
          )}
        >
          {selectedDoctor === null ? (
            <div className="py-6 text-center text-body-sm text-on-surface-variant">
              Select a doctor above to inspect today&apos;s schedule.
            </div>
          ) : scheduleData.error ? (
            <ErrorBanner message={scheduleData.error} onRetry={scheduleData.reload} />
          ) : isScheduleLoading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={52} rounded="xl" />
              ))}
            </div>
          ) : slotRows.length === 0 ? (
            <EmptyState icon="schedule" title="No working slots scheduled for today" />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Filter Pills & 2-Color Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={cn(
                      'rounded-full px-3 py-1 text-label-md font-medium transition-colors',
                      filter === 'all'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high',
                    )}
                  >
                    All ({slotRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('free')}
                    className={cn(
                      'rounded-full px-3 py-1 text-label-md font-medium transition-colors',
                      filter === 'free'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high',
                    )}
                  >
                    Free ({freeSlotCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('booked')}
                    className={cn(
                      'rounded-full px-3 py-1 text-label-md font-medium transition-colors',
                      filter === 'booked'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high',
                    )}
                  >
                    Booked ({bookedSlotCount})
                  </button>
                </div>

                <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-outline" />
                    Unavailable
                  </span>
                </div>
              </div>

              {filteredSlots.length === 0 ? (
                <div className="py-8 text-center text-body-sm text-on-surface-variant">
                  No slots match the selected filter.
                </div>
              ) : (
                /* Compact 2D Grid of Time Slots */
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    const occupant = slot.occupant;

                    return (
                      <div
                        key={slot.time}
                        onClick={slot.isAvailable ? () => handleSlotClick(slot.time) : undefined}
                        className={cn(
                          'relative flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all min-h-[58px] select-none',
                          isSelected
                            ? 'border-primary bg-primary-container/30 ring-2 ring-primary shadow-sm cursor-pointer'
                            : slot.isAvailable
                              ? 'border-success/40 bg-success-container/20 text-on-surface hover:bg-success-container/40 hover:border-success hover:shadow-sm cursor-pointer'
                              : 'border-outline-variant/60 bg-surface-container-low text-on-surface-variant/60 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              'font-mono text-body-md font-semibold',
                              slot.isAvailable ? 'text-on-surface' : 'text-on-surface-variant/70',
                            )}
                          >
                            {formatTime(slot.time)}
                          </span>

                          {slot.isAvailable ? (
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full',
                                isSelected ? 'bg-primary text-on-primary' : 'bg-success/15 text-success',
                              )}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isSelected ? 'done' : 'add'}
                              </span>
                            </span>
                          ) : occupant &&
                            (occupant.status === 'Scheduled' || occupant.status === 'Re-Scheduled') ? (
                            <button
                              type="button"
                              title={`Reschedule ${occupant.patientName ?? 'appointment'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setRescheduleTarget(occupant);
                              }}
                              className="flex h-5 w-5 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                event_repeat
                              </span>
                            </button>
                          ) : null}
                        </div>

                        {occupant && (
                          <div
                            className="truncate text-label-sm font-medium text-on-surface-variant/80"
                            title={occupant.patientName ?? `Patient #${occupant.patientId}`}
                          >
                            {occupant.patientName ?? `Patient #${occupant.patientId}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-outline-variant bg-surface-container-lowest/95 p-3 backdrop-blur md:sticky md:bottom-4 md:border-none md:bg-transparent md:p-0">
        <Card className="shadow-popover">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm md:flex md:flex-wrap md:items-center md:gap-6">
              <div>
                <span className="block text-label-sm text-on-surface-variant">Patient</span>
                <span className="truncate font-medium text-on-surface">
                  {selectedPatient
                    ? formatFullName(selectedPatient.firstName, selectedPatient.lastName)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="block text-label-sm text-on-surface-variant">Doctor</span>
                <span className="truncate font-medium text-on-surface">
                  {selectedDoctor ? `Dr. ${selectedDoctor.doctorName}` : '—'}
                </span>
              </div>
              <div>
                <span className="block text-label-sm text-on-surface-variant">Selected Slot</span>
                <span className="truncate font-medium text-on-surface">
                  {selectedTime ? `Today · ${formatTime(selectedTime)}` : 'None selected'}
                </span>
              </div>
              {selectedDoctor && (
                <div>
                  <span className="block text-label-sm text-on-surface-variant">Consultation Fee</span>
                  <span className="truncate font-semibold text-primary">
                    {formatCurrency(selectedDoctor.consultationFee)}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full shrink-0 md:w-auto"
              isLoading={isSubmitting}
              disabled={!canConfirm}
              onClick={() => {
                if (selectedTime) {
                  setSlotToConfirm(selectedTime);
                }
              }}
            >
              Confirm walk-in
            </Button>
          </div>
        </Card>
      </div>

      {/* Walk-in Booking Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(slotToConfirm)}
        title="Confirm Walk-in Appointment"
        message={
          selectedPatient && selectedDoctor && slotToConfirm
            ? `Book walk-in appointment for ${formatFullName(
                selectedPatient.firstName,
                selectedPatient.lastName,
              )} with Dr. ${selectedDoctor.doctorName} today at ${formatTime(slotToConfirm)}?`
            : undefined
        }
        confirmLabel="Confirm & Book"
        cancelLabel="Cancel"
        tone="default"
        isPending={isSubmitting}
        onConfirm={() => {
          if (slotToConfirm) {
            handleBookWalkIn(slotToConfirm);
          }
        }}
        onCancel={() => setSlotToConfirm(null)}
      />

      {/* In-place Reschedule Drawer */}
      <RescheduleAppointmentDrawer
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={(newAppointment) => {
          toast.success(
            `Appointment rescheduled to ${newAppointment.appointmentDate} at ${formatTime(
              newAppointment.appointmentTime,
            )}`,
          );
          if (selectedTime === rescheduleTarget?.appointmentTime) {
            setSelectedTime(null);
          }
          setRescheduleTarget(null);
          scheduleData.reload();
        }}
      />
    </div>
  );
}
