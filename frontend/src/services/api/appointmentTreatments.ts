import { apiGet, apiPatch, apiPost } from './client';
import type {
  Appointment,
  AppointmentTreatment,
  BatchTreatmentCreateResult,
} from '../../types';

export async function fetchAppointmentTreatments(appointmentId: number): Promise<AppointmentTreatment[]> {
  return apiGet<AppointmentTreatment[]>(`/appointments/${appointmentId}/treatments`);
}

export async function logAppointmentTreatments(
  appointmentId: number,
  inputs: Array<{
    serviceCode: string;
  }>,
): Promise<BatchTreatmentCreateResult> {
  return apiPost<BatchTreatmentCreateResult>(
    `/appointments/${appointmentId}/treatments`,
    inputs,
  );
}

export async function amendAppointmentTreatment(
  appointmentTreatmentId: number,
  input: {
    serviceCode: string;
    amendmentReason: string;
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
