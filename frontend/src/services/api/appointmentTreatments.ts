import { apiGet, apiPatch, apiPost } from './client';
import type { Appointment, AppointmentTreatment } from '../../types';

export async function fetchAppointmentTreatments(appointmentId: number): Promise<AppointmentTreatment[]> {
  return apiGet<AppointmentTreatment[]>(`/appointments/${appointmentId}/treatments`);
}

export async function logAppointmentTreatment(
  appointmentId: number,
  input: {
    service_code: string;
  },
): Promise<AppointmentTreatment> {
  return apiPost<AppointmentTreatment>(`/appointments/${appointmentId}/treatments`, input);
}

export async function amendAppointmentTreatment(
  appointmentTreatmentId: number,
  input: {
    service_code: string;
    amendment_reason: string;
  },
): Promise<AppointmentTreatment> {
  return apiPost<AppointmentTreatment>(`/appointment-treatments/${appointmentTreatmentId}/amend`, input);
}

export async function saveConsultationNotes(
  appointmentId: number,
  notes: string,
): Promise<Appointment> {
  return apiPatch<Appointment>(`/appointments/${appointmentId}/notes`, { notes });
}
