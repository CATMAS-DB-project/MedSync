export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Appointment {
  appointmentId: number;
  patientId: number;
  patientName?: string;
  doctorStaffId: number;
  doctorName?: string;
  branchId: number;
  branchName?: string;
  bookedByStaffId: number;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  isWalkIn: boolean;
  cancelRescheduleReason?: string;
  consultationNotes?: string;
  createdAt: string;
}

export interface AppointmentRescheduleLog {
  rescheduleId: number;
  appointmentId: number;
  previousDate: string;
  previousTime: string;
  newDate: string;
  newTime: string;
  reason?: string;
  rescheduledByStaffId?: number;
  rescheduledAt: string;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}
