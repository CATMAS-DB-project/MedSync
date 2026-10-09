import { apiGet } from './client';

export interface ReportQueryParams extends Record<string, unknown> {
  branchId?: number;
  category?: string;
  from?: string;
  to?: string;
}

export interface AppointmentSummaryReportItem {
  appointmentDate: string;
  totalCount: number;
  scheduledCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface DoctorRevenueReportItem {
  branchId: number;
  branchName: string;
  doctorStaffId: number;
  doctorName: string;
  appointmentCount: number;
  revenue: number;
  revenueRank: number;
}

export interface OutstandingBalanceReportItem {
  invoiceId: number;
  appointmentId: number;
  patientId: number;
  patientName: string;
  branchId: number;
  branchName: string;
  payableAmount: number;
  amountPaid: number;
  outstandingAmount: number;
}

export interface TreatmentFrequencyReportItem {
  serviceCode: string;
  treatmentName: string;
  category: string;
  treatmentCount: number;
}

export interface InsuranceVsOutOfPocketReport {
  invoiceCount: number;
  subtotalAmount: number;
  insuranceAmount: number;
  outOfPocketAmount: number;
}

export async function fetchAppointmentsSummary(
  params?: ReportQueryParams,
): Promise<AppointmentSummaryReportItem[]> {
  return apiGet<AppointmentSummaryReportItem[]>('/reports/appointments-summary', params);
}

export async function fetchDoctorRevenue(
  params?: ReportQueryParams,
): Promise<DoctorRevenueReportItem[]> {
  return apiGet<DoctorRevenueReportItem[]>('/reports/doctor-revenue', params);
}

export async function fetchOutstandingBalances(
  params?: Pick<ReportQueryParams, 'branchId'>,
): Promise<OutstandingBalanceReportItem[]> {
  return apiGet<OutstandingBalanceReportItem[]>('/reports/outstanding-balances', params);
}

export async function fetchTreatmentFrequency(
  params?: Pick<ReportQueryParams, 'category' | 'from' | 'to'>,
): Promise<TreatmentFrequencyReportItem[]> {
  return apiGet<TreatmentFrequencyReportItem[]>('/reports/treatment-frequency', params);
}

export async function fetchInsuranceVsOutOfPocket(
  params?: ReportQueryParams,
): Promise<InsuranceVsOutOfPocketReport> {
  return apiGet<InsuranceVsOutOfPocketReport>('/reports/insurance-vs-outofpocket', params);
}
