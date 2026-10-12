import {
  bookAppointment,
  cancelAppointment,
  fetchAppointmentAvailability,
  fetchAppointments,
} from '../../services/api/appointments';
import { ApiError } from '../../services/api/ApiError';
import { addDays } from '../appointments/dateUtils';
import { nowHHMM, todayIso } from '../../utils/dates';
import type { Appointment } from '../../types';

// ---------- Current target slot ----------

export interface TargetSlot {
  time: string;
  kind: 'free' | 'occupied';
  occupant?: Appointment;
}

export interface FindCurrentSuccess {
  ok: true;
  slot: TargetSlot;
}

export interface FindCurrentFailure {
  ok: false;
  message: string;
}

export type FindCurrentResult = FindCurrentSuccess | FindCurrentFailure;

/**
 * Finds the doctor's current target slot for today.
 * - Merges free slots (availability) with occupied times (Scheduled appointments).
 * - "Current" = latest time <= now, or first slot if now is before every slot.
 * - Walks forward from there; returns the first free or Scheduled-occupied slot.
 * - Completed / unavailable slots are skipped.
 */
export async function findCurrentTarget(
  doctorId: number,
  branchId: number,
): Promise<FindCurrentResult> {
  const today = todayIso();
  try {
    const [availability, appointments] = await Promise.all([
      fetchAppointmentAvailability(doctorId, today),
      fetchAppointments({ branchId, doctorId, date: today, pageSize: 100 }),
    ]);

    const scheduledByTime = new Map<string, Appointment>();
    for (const a of appointments.items) {
      if (a.status === 'Scheduled' || a.status === 'Re-Scheduled') {
        scheduledByTime.set(a.appointmentTime, a);
      }
    }

    const availByTime = new Map<string, boolean>();
    for (const s of availability) availByTime.set(s.time, s.available);

    const times = new Set<string>();
    for (const s of availability) times.add(s.time);
    for (const a of appointments.items) times.add(a.appointmentTime);

    if (times.size === 0) {
      return { ok: false, message: 'No working slots today for this doctor' };
    }

    const sorted = Array.from(times).sort();

    const now = nowHHMM();
    let startIdx = 0;
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i] <= now) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx; i < sorted.length; i += 1) {
      const time = sorted[i];
      const occupant = scheduledByTime.get(time);
      if (occupant) {
        return { ok: true, slot: { time, kind: 'occupied', occupant } };
      }
      if (availByTime.get(time) === true) {
        return { ok: true, slot: { time, kind: 'free' } };
      }
      // Not free and no Scheduled appointment here — skip (e.g. Completed).
    }

    return { ok: false, message: 'No working slots today for this doctor' };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof ApiError ? err.message : "Failed to load today's slots for this doctor",
    };
  }
}

// ---------- New slot for the displaced patient ----------

export interface NewSlot {
  date: string;
  time: string;
}

/**
 * First free slot strictly after `fromTime` today, else first free slot on
 * the following days, up to `maxDaysAhead` days from today.
 */
export async function findNewSlotForDisplaced(
  doctorId: number,
  fromTime: string,
  maxDaysAhead = 7,
): Promise<NewSlot | null> {
  const today = todayIso();
  for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
    const date = addDays(today, offset);
    try {
      const availability = await fetchAppointmentAvailability(doctorId, date);
      const sorted = [...availability].sort((a, b) => a.time.localeCompare(b.time));
      for (const slot of sorted) {
        if (!slot.available) continue;
        if (offset === 0 && slot.time <= fromTime) continue;
        return { date, time: slot.time };
      }
    } catch {
      // Ignore a failed day and continue.
    }
  }
  return null;
}

// ---------- Move flow (a → b → c) ----------

export interface MoveInput {
  emergencyPatientId: number;
  branchId: number;
  doctorStaffId: number;
  targetAppointment: Appointment;
  targetDate: string;
  targetTime: string;
  newDate: string;
  newTime: string;
}

export type MoveResult =
  | { kind: 'success'; movedAppointmentId: number; emergencyAppointmentId: number }
  | { kind: 'occupant_changed' }
  | { kind: 'step_a_failed'; message: string; isConflict: boolean }
  | { kind: 'step_b_failed_rolled_back'; message: string }
  | {
      kind: 'step_b_failed_rollback_failed';
      message: string;
      newAppointmentId: number;
      oldAppointmentId: number;
    }
  | {
      kind: 'step_c_failed';
      message: string;
      isConflict: boolean;
      movedAppointmentId: number;
    };

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function isConflictError(err: unknown): boolean {
  return err instanceof ApiError && err.isConflict;
}

export async function executeMove(input: MoveInput): Promise<MoveResult> {
  // Pre-check the occupant — refuse if it changed.
  try {
    const fresh = await fetchAppointments({
      branchId: input.branchId,
      doctorId: input.doctorStaffId,
      date: input.targetDate,
      pageSize: 100,
    });
    const current = fresh.items.find(
      (a) =>
        a.appointmentTime === input.targetTime &&
        (a.status === 'Scheduled' || a.status === 'Re-Scheduled'),
    );
    if (!current || current.appointmentId !== input.targetAppointment.appointmentId) {
      return { kind: 'occupant_changed' };
    }
  } catch (err) {
    return {
      kind: 'step_a_failed',
      message: messageOf(err, 'Could not verify the slot'),
      isConflict: false,
    };
  }

  // a) Book the displaced patient at their new slot.
  let newAppointmentId: number;
  try {
    const created = await bookAppointment({
      patientId: input.targetAppointment.patientId,
      doctorStaffId: input.doctorStaffId,
      branchId: input.branchId,
      appointmentDate: input.newDate,
      appointmentTime: input.newTime,
    });
    newAppointmentId = created.appointmentId;
  } catch (err) {
    return {
      kind: 'step_a_failed',
      message: messageOf(err, 'Could not book the new slot'),
      isConflict: isConflictError(err),
    };
  }

  // b) Cancel the old appointment.
  try {
    await cancelAppointment(input.targetAppointment.appointmentId, {
      reason: 'Displaced by emergency walk-in',
    });
  } catch (err) {
    try {
      await cancelAppointment(newAppointmentId, { reason: 'Rolled back' });
      return {
        kind: 'step_b_failed_rolled_back',
        message: messageOf(err, 'Could not cancel the old appointment'),
      };
    } catch (rollbackErr) {
      return {
        kind: 'step_b_failed_rollback_failed',
        message: `${messageOf(err, 'Cancel failed')} — rollback failed: ${messageOf(
          rollbackErr,
          'unknown error',
        )}`,
        newAppointmentId,
        oldAppointmentId: input.targetAppointment.appointmentId,
      };
    }
  }

  // c) Book the emergency patient into the freed slot.
  try {
    const emergency = await bookAppointment({
      patientId: input.emergencyPatientId,
      doctorStaffId: input.doctorStaffId,
      branchId: input.branchId,
      appointmentDate: input.targetDate,
      appointmentTime: input.targetTime,
      isWalkIn: true,
    });
    return {
      kind: 'success',
      movedAppointmentId: newAppointmentId,
      emergencyAppointmentId: emergency.appointmentId,
    };
  } catch (err) {
    return {
      kind: 'step_c_failed',
      message: messageOf(err, 'Could not book the walk-in'),
      isConflict: isConflictError(err),
      movedAppointmentId: newAppointmentId,
    };
  }
}

// ---------- Retry only step c ----------

export interface RetryWalkInInput {
  emergencyPatientId: number;
  branchId: number;
  doctorStaffId: number;
  date: string;
  time: string;
}

export type RetryWalkInResult =
  | { ok: true; appointmentId: number }
  | { ok: false; message: string; isConflict: boolean };

export async function retryWalkIn(input: RetryWalkInInput): Promise<RetryWalkInResult> {
  try {
    const appointment = await bookAppointment({
      patientId: input.emergencyPatientId,
      doctorStaffId: input.doctorStaffId,
      branchId: input.branchId,
      appointmentDate: input.date,
      appointmentTime: input.time,
      isWalkIn: true,
    });
    return { ok: true, appointmentId: appointment.appointmentId };
  } catch (err) {
    return {
      ok: false,
      message: messageOf(err, 'Could not book the walk-in'),
      isConflict: isConflictError(err),
    };
  }
}
