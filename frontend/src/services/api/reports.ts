import { apiGet, apiGetBlob } from './client';

export interface ReportQueryParams extends Record<string, unknown> {
  branchId?: number;
  patientId?: number;
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
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<AppointmentSummaryReportItem[]> {
  const rows = await apiGet<AppointmentSummaryReportItem[]>('/reports/appointments-summary', params);
  return rows.map((row) => ({
    ...row,
    totalCount: Number(row.totalCount),
    scheduledCount: Number(row.scheduledCount),
    completedCount: Number(row.completedCount),
    cancelledCount: Number(row.cancelledCount),
  }));
}

export async function fetchDoctorRevenue(
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<DoctorRevenueReportItem[]> {
  const rows = await apiGet<DoctorRevenueReportItem[]>('/reports/doctor-revenue', params);
  return rows.map((row) => ({
    ...row,
    appointmentCount: Number(row.appointmentCount),
    revenue: Number(row.revenue),
    revenueRank: Number(row.revenueRank),
  }));
}

export async function fetchOutstandingBalances(
  params?: Pick<ReportQueryParams, 'branchId' | 'patientId'>,
): Promise<OutstandingBalanceReportItem[]> {
  const rows = await apiGet<OutstandingBalanceReportItem[]>('/reports/outstanding-balances', params);
  return rows.map((row) => ({
    ...row,
    payableAmount: Number(row.payableAmount),
    amountPaid: Number(row.amountPaid),
    outstandingAmount: Number(row.outstandingAmount),
  }));
}

export async function fetchTreatmentFrequency(
  params?: Pick<ReportQueryParams, 'branchId' | 'category' | 'from' | 'to'>,
): Promise<TreatmentFrequencyReportItem[]> {
  const rows = await apiGet<TreatmentFrequencyReportItem[]>('/reports/treatment-frequency', params);
  return rows.map((row) => ({
    ...row,
    treatmentCount: Number(row.treatmentCount),
  }));
}

export async function fetchInsuranceVsOutOfPocket(
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<InsuranceVsOutOfPocketReport> {
  const raw = await apiGet<InsuranceVsOutOfPocketReport>('/reports/insurance-vs-outofpocket', params);
  return {
    invoiceCount: Number(raw.invoiceCount),
    subtotalAmount: Number(raw.subtotalAmount),
    insuranceAmount: Number(raw.insuranceAmount),
    outOfPocketAmount: Number(raw.outOfPocketAmount),
  };
}

export async function downloadAppointmentsSummaryPdf(
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<Blob> {
  return apiGetBlob('/reports/pdf/appointments-summary', params);
}

export async function downloadDoctorRevenuePdf(
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<Blob> {
  return apiGetBlob('/reports/pdf/doctor-revenue', params);
}

export async function downloadOutstandingBalancesPdf(
  params?: Pick<ReportQueryParams, 'branchId'>,
): Promise<Blob> {
  return apiGetBlob('/reports/pdf/outstanding-balances', params);
}

export async function downloadTreatmentFrequencyPdf(
  params?: Pick<ReportQueryParams, 'branchId' | 'category' | 'from' | 'to'>,
): Promise<Blob> {
  return apiGetBlob('/reports/pdf/treatment-frequency', params);
}

export async function downloadInsuranceSummaryPdf(
  params?: Pick<ReportQueryParams, 'branchId' | 'from' | 'to'>,
): Promise<Blob> {
  return apiGetBlob('/reports/pdf/insurance-summary', params);
}

