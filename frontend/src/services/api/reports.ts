import { apiGet } from './client';

export interface AppointmentSummaryReportItem {
  date: string;
  scheduled: number;
  completed: number;
  cancelled: number;
}

export interface DoctorRevenueReportItem {
  doctorId: number;
  doctorName: string;
  branchId: number;
  revenue: number;
  rank?: number;
}

export interface OutstandingBalanceReportItem {
  patientId: number;
  patientName: string;
  branchId?: number;
  outstanding: number;
}

export interface TreatmentFrequencyReportItem {
  treatmentName: string;
  category?: string;
  count: number;
}

export interface InsuranceVsOutOfPocketReportItem {
  branchId: number;
  insuranceAmount: number;
  outOfPocketAmount: number;
  date?: string;
}

export async function fetchAppointmentsSummary(
  params?: Record<string, unknown>,
): Promise<AppointmentSummaryReportItem[]> {
  return apiGet<AppointmentSummaryReportItem[]>('/reports/appointments-summary', params);
}

export async function fetchDoctorRevenue(
  params?: Record<string, unknown>,
): Promise<DoctorRevenueReportItem[]> {
  return apiGet<DoctorRevenueReportItem[]>('/reports/doctor-revenue', params);
}

export async function fetchOutstandingBalances(
  params?: Record<string, unknown>,
): Promise<OutstandingBalanceReportItem[]> {
  return apiGet<OutstandingBalanceReportItem[]>('/reports/outstanding-balances', params);
}

export async function fetchTreatmentFrequency(
  params?: Record<string, unknown>,
): Promise<TreatmentFrequencyReportItem[]> {
  return apiGet<TreatmentFrequencyReportItem[]>('/reports/treatment-frequency', params);
}

export async function fetchInsuranceVsOutOfPocket(
  params?: Record<string, unknown>,
): Promise<InsuranceVsOutOfPocketReportItem[]> {
  return apiGet<InsuranceVsOutOfPocketReportItem[]>('/reports/insurance-vs-outofpocket', params);
}
