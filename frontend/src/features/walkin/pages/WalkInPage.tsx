import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { useToast } from '../../../components/common/ToastProvider';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { bookAppointment } from '../../../services/api/appointments';
import { fetchDoctorOptions } from '../../../services/api/doctorOptions';
import type { DoctorOption } from '../../../services/api/doctorOptions';
import { fetchPatientById } from '../../../services/api/patients';
import { ROUTES } from '../../../constants/routes';
import { todayIso } from '../../../utils/dates';
import { formatFullName, formatTime } from '../../../utils/formatters';
import { PatientPicker } from '../../appointments/components/PatientPicker';
import { DoctorCard } from '../../appointments/components/DoctorCard';
import { BookingSuccess } from '../../appointments/components/BookingSuccess';
import {
  executeMove,
  findCurrentTarget,
  findNewSlotForDisplaced,
  retryWalkIn,
} from '../walkInFlow';
import type { Appointment, Patient } from '../../../types';

interface DisplacementState {
  occupant: Appointment;
  targetTime: string;
  newDate: string;
  newTime: string;
  attemptedRecompute: boolean;
}

interface StepCFailedState {
  displacedName: string;
  displacedDate: string;
  displacedTime: string;
  displacedPhone: string | null;
  emergencyPatientId: number;
  doctorStaffId: number;
  targetTime: string;
  error: string;
  isConflict: boolean;
}

interface SuccessState {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  fee: number;
  displaced?: {
    name: string;
    date: string;
    time: string;
    phone: string | null;
  };
}

async function fetchPhoneSafe(patientId: number): Promise<string | null> {
  try {
    const patient = await fetchPatientById(patientId);
    return patient.phones?.[0]?.phoneNumber ?? null;
  } catch {
    return null;
  }
}

export function WalkInPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const today = todayIso();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displacement, setDisplacement] = useState<DisplacementState | null>(null);
  const [stepCFailed, setStepCFailed] = useState<StepCFailedState | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const resetAll = useCallback(() => {
    setSelectedPatient(null);
    setSelectedDoctorId(null);
    setError(null);
    setDisplacement(null);
    setStepCFailed(null);
    setSuccess(null);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!currentUser || !selectedPatient || !selectedDoctor || isBusy) return;
    setIsBusy(true);
    setError(null);
    setStepCFailed(null);

    try {
      const result = await findCurrentTarget(selectedDoctor.staffId, currentUser.branchId);
      if (!isMountedRef.current) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Free slot → single booking call.
      if (result.slot.kind === 'free') {
        try {
          await bookAppointment({
            patientId: selectedPatient.patientId,
            doctorStaffId: selectedDoctor.staffId,
            branchId: currentUser.branchId,
            appointmentDate: today,
            appointmentTime: result.slot.time,
            isWalkIn: true,
          });
          if (!isMountedRef.current) return;
          setSuccess({
            patientName: formatFullName(selectedPatient.firstName, selectedPatient.lastName),
            doctorName: selectedDoctor.doctorName,
            date: today,
            time: result.slot.time,
            fee: selectedDoctor.consultationFee,
          });
          toast.success('Walk-in registered');
        } catch (err) {
          if (!isMountedRef.current) return;
          setError(
            err instanceof ApiError && err.isConflict
              ? 'That slot was just taken. Try again.'
              : err instanceof ApiError
                ? err.message
                : 'Could not register the walk-in.',
          );
        }
        return;
      }

      // Occupied → find a new slot for the displaced patient.
      const occupant = result.slot.occupant;
      if (!occupant) {
        setError('Could not load the occupant of the current slot.');
        return;
      }

      const newSlot = await findNewSlotForDisplaced(selectedDoctor.staffId, result.slot.time);
      if (!isMountedRef.current) return;
      if (!newSlot) {
        setError('No free slot in the next 7 days to move the displaced patient.');
        return;
      }

      setDisplacement({
        occupant,
        targetTime: result.slot.time,
        newDate: newSlot.date,
        newTime: newSlot.time,
        attemptedRecompute: false,
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      if (isMountedRef.current) setIsBusy(false);
    }
  }, [currentUser, selectedPatient, selectedDoctor, isBusy, today, toast]);

  const handleConfirmMove = useCallback(async () => {
    if (!currentUser || !selectedPatient || !selectedDoctor || !displacement || isBusy) return;
    setIsBusy(true);
    setError(null);

    try {
      const result = await executeMove({
        emergencyPatientId: selectedPatient.patientId,
        branchId: currentUser.branchId,
        doctorStaffId: selectedDoctor.staffId,
        targetAppointment: displacement.occupant,
        targetDate: today,
        targetTime: displacement.targetTime,
        newDate: displacement.newDate,
        newTime: displacement.newTime,
      });
      if (!isMountedRef.current) return;

      if (result.kind === 'success') {
        const displacedPhone = await fetchPhoneSafe(displacement.occupant.patientId);
        if (!isMountedRef.current) return;
        setSuccess({
          patientName: formatFullName(selectedPatient.firstName, selectedPatient.lastName),
          doctorName: selectedDoctor.doctorName,
          date: today,
          time: displacement.targetTime,
          fee: selectedDoctor.consultationFee,
          displaced: {
            name: displacement.occupant.patientName ?? 'Patient',
            date: displacement.newDate,
            time: displacement.newTime,
            phone: displacedPhone,
          },
        });
        setDisplacement(null);
        toast.success('Walk-in registered');
        return;
      }

      if (result.kind === 'occupant_changed') {
        setDisplacement(null);
        setError('The slot changed. Please try again.');
        return;
      }

      if (result.kind === 'step_a_failed') {
        if (result.isConflict && !displacement.attemptedRecompute) {
          const newSlot = await findNewSlotForDisplaced(
            selectedDoctor.staffId,
            displacement.targetTime,
          );
          if (!isMountedRef.current) return;
          if (!newSlot) {
            setDisplacement(null);
            setError('Could not find another free slot to move the displaced patient.');
          } else {
            setDisplacement({
              ...displacement,
              newDate: newSlot.date,
              newTime: newSlot.time,
              attemptedRecompute: true,
            });
            toast.info('Slot changed — new time proposed.');
          }
        } else {
          setDisplacement(null);
          setError(result.message);
        }
        return;
      }

      if (result.kind === 'step_b_failed_rolled_back') {
        setDisplacement(null);
        setError(result.message);
        return;
      }

      if (result.kind === 'step_b_failed_rollback_failed') {
        setDisplacement(null);
        setError(
          `${result.message} (new #${result.newAppointmentId}, original #${result.oldAppointmentId})`,
        );
        return;
      }

      // step_c_failed — displaced patient is moved; walk-in was not booked.
      const displacedPhone = await fetchPhoneSafe(displacement.occupant.patientId);
      if (!isMountedRef.current) return;
      setDisplacement(null);
      setStepCFailed({
        displacedName: displacement.occupant.patientName ?? 'Patient',
        displacedDate: displacement.newDate,
        displacedTime: displacement.newTime,
        displacedPhone,
        emergencyPatientId: selectedPatient.patientId,
        doctorStaffId: selectedDoctor.staffId,
        targetTime: displacement.targetTime,
        error: result.message,
        isConflict: result.isConflict,
      });
    } finally {
      if (isMountedRef.current) setIsBusy(false);
    }
  }, [currentUser, selectedPatient, selectedDoctor, displacement, isBusy, today, toast]);

  const handleRetryWalkIn = useCallback(async () => {
    if (!currentUser || !stepCFailed || isBusy) return;
    setIsBusy(true);
    setError(null);

    const result = await retryWalkIn({
      emergencyPatientId: stepCFailed.emergencyPatientId,
      branchId: currentUser.branchId,
      doctorStaffId: stepCFailed.doctorStaffId,
      date: today,
      time: stepCFailed.targetTime,
    });
    if (!isMountedRef.current) return;

    if (result.ok) {
      setSuccess({
        patientName: selectedPatient
          ? formatFullName(selectedPatient.firstName, selectedPatient.lastName)
          : 'Patient',
        doctorName: selectedDoctor?.doctorName ?? '',
        date: today,
        time: stepCFailed.targetTime,
        fee: selectedDoctor?.consultationFee ?? 0,
        displaced: {
          name: stepCFailed.displacedName,
          date: stepCFailed.displacedDate,
          time: stepCFailed.displacedTime,
          phone: stepCFailed.displacedPhone,
        },
      });
      setStepCFailed(null);
      toast.success('Walk-in registered');
    } else if (result.isConflict) {
      setStepCFailed((prev) =>
        prev
          ? {
              ...prev,
              isConflict: true,
              error: 'Someone took the slot. Pick another doctor or time.',
            }
          : prev,
      );
    } else {
      setStepCFailed((prev) => (prev ? { ...prev, error: result.message } : prev));
    }
    if (isMountedRef.current) setIsBusy(false);
  }, [currentUser, stepCFailed, isBusy, today, selectedPatient, selectedDoctor, toast]);

  const handleClosePartial = useCallback(() => {
    if (!stepCFailed) return;
    toast.info(`${stepCFailed.displacedName} moved. Walk-in was not registered.`);
    resetAll();
  }, [stepCFailed, toast, resetAll]);

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
          extra={
            success.displaced ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-warning-container/50 p-4">
                <div className="flex items-start gap-2 text-body-sm text-on-warning-container">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    aria-hidden="true"
                  >
                    swap_horiz
                  </span>
                  <span>
                    {success.displaced.name} moved to {success.displaced.date}{' '}
                    {formatTime(success.displaced.time)}
                  </span>
                </div>
                {success.displaced.phone && (
                  <Badge tone="neutral" pill>
                    {success.displaced.phone}
                  </Badge>
                )}
              </div>
            ) : undefined
          }
          onBookAnother={resetAll}
          onViewAppointments={() =>
            navigate(
              `${ROUTES.APPOINTMENTS}?date=${success.date}&branchId=${currentUser.branchId}`,
            )
          }
        />
      </div>
    );
  }

  const isDoctorsLoading = doctors.isLoading && doctorList.length === 0;
  const canRegister = selectedPatient !== null && selectedDoctor !== null && !isBusy;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Walk-in" backTo={ROUTES.APPOINTMENTS} />

      <Card padding="none">
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

      <Card padding="none">
        <header className="flex items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">
            2
          </span>
          <h2 className="text-headline-sm text-on-surface">Doctor</h2>
        </header>
        <div
          className={
            selectedPatient === null
              ? 'pointer-events-none p-4 opacity-50 select-none sm:p-5'
              : 'p-4 sm:p-5'
          }
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

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {stepCFailed && (
        <Card className="border-warning/40 bg-warning-container/40">
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-on-warning-container">
              {stepCFailed.displacedName} was moved to {stepCFailed.displacedDate}{' '}
              {formatTime(stepCFailed.displacedTime)}. Walk-in booking failed:{' '}
              {stepCFailed.error}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleClosePartial}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={handleRetryWalkIn}
                isLoading={isBusy}
                disabled={stepCFailed.isConflict}
              >
                Retry walk-in
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="sticky bottom-4 z-10">
        <Card className="shadow-popover">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-body-sm">
                <span className="text-label-md text-on-surface-variant">Patient</span>
                <span className="truncate font-medium text-on-surface">
                  {selectedPatient
                    ? formatFullName(selectedPatient.firstName, selectedPatient.lastName)
                    : '—'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-body-sm">
                <span className="text-label-md text-on-surface-variant">Doctor</span>
                <span className="truncate font-medium text-on-surface">
                  {selectedDoctor ? `Dr. ${selectedDoctor.doctorName}` : '—'}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full shrink-0 sm:w-auto"
              isLoading={isBusy}
              disabled={!canRegister}
              onClick={handleRegister}
            >
              Register walk-in
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={displacement !== null}
        title="Slot taken"
        message={
          displacement
            ? `${displacement.occupant.patientName ?? 'The current patient'} is booked at ${formatTime(
                displacement.targetTime,
              )} with Dr. ${selectedDoctor?.doctorName ?? ''}. They will be moved to ${
                displacement.newDate
              } ${formatTime(displacement.newTime)}. Continue?`
            : ''
        }
        confirmLabel="Move and register"
        cancelLabel="Cancel"
        tone="default"
        isPending={isBusy}
        onConfirm={handleConfirmMove}
        onCancel={() => {
          if (isBusy) return;
          setDisplacement(null);
        }}
      />
    </div>
  );
}
