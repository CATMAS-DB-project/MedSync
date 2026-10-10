import { apiGet, apiPatch, apiPost } from './client';
import type { Appointment, AppointmentStatus, AvailabilitySlot, PagedResult } from '../../types';

export interface AppointmentListParams
  extends Record<string, string | number | boolean | undefined> {
  branchId?: number;
  doctorId?: number;
  date?: string;
  status?: AppointmentStatus;
  patientId?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Matches the backend's AppointmentCreate schema.
 * `bookedByStaffId` is NOT sent: the backend takes it from the logged-in user.
 * `branchId` IS required by the backend.
 */
export interface BookAppointmentInput {
  patientId: number;
  doctorStaffId: number;
  branchId: number;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM
  isWalkIn?: boolean;
}

export async function fetchAppointments(params?: AppointmentListParams): Promise<PagedResult<Appointment>> {
  return apiGet<PagedResult<Appointment>>('/appointments', params);
}

export async function fetchAppointmentById(appointmentId: number): Promise<Appointment> {
  return apiGet<Appointment>(`/appointments/${appointmentId}`);
}

export async function bookAppointment(input: BookAppointmentInput): Promise<Appointment> {
  return apiPost<Appointment>('/appointments', input);
}

export async function rescheduleAppointment(
  appointmentId: number,
  input: {
    appointmentDate: string;
    appointmentTime: string;
    reason?: string;
  },
): Promise<Appointment> {
  return apiPatch<Appointment>(`/appointments/${appointmentId}`, input);
}

export async function cancelAppointment(
  appointmentId: number,
  input: { reason: string },
): Promise<Appointment> {
  return apiPost<Appointment>(`/appointments/${appointmentId}/cancel`, input);
}

export async function completeAppointment(appointmentId: number): Promise<Appointment> {
  return apiPost<Appointment>(`/appointments/${appointmentId}/complete`);
}

export async function fetchAppointmentAvailability(
  doctorId: number,
  date: string,
): Promise<AvailabilitySlot[]> {
  return apiGet<AvailabilitySlot[]>('/appointments/availability', { doctor_id: doctorId, date });
}

export async function fetchRescheduleHistory(
  appointmentId: number,
): Promise<Appointment[]> {
  return apiGet<Appointment[]>(`/appointments/${appointmentId}/reschedule-history`);
}
