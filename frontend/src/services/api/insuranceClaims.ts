import { apiGet, apiPost } from './client';
import type { ClaimVerificationStatus, InsuranceClaim, PagedResult } from '../../types';

export interface InsuranceClaimListParams
  extends Record<string, string | number | boolean | undefined> {
  status?: ClaimVerificationStatus;
  branchId?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchInsuranceClaims(
  params?: InsuranceClaimListParams,
): Promise<PagedResult<InsuranceClaim>> {
  const queryParams = params as Record<string, unknown> | undefined;
  return apiGet<PagedResult<InsuranceClaim>>('/insurance-claims', queryParams);
}

export async function createInsuranceClaim(
  invoiceId: number,
  input: {
    policyId: string;
    claimedAmount: number;
  },
): Promise<InsuranceClaim> {
  return apiPost<InsuranceClaim>(`/invoices/${invoiceId}/claim`, input);
}

export async function verifyInsuranceClaim(
  claimId: number,
  input: {
    approvedAmount: number;
    verificationStatus: Extract<ClaimVerificationStatus, 'Approved' | 'Rejected'>;
  },
): Promise<InsuranceClaim> {
  return apiPost<InsuranceClaim>(`/insurance-claims/${claimId}/verify`, input);
}

export async function fetchInsuranceClaimById(claimId: number): Promise<InsuranceClaim> {
  return apiGet<InsuranceClaim>(`/insurance-claims/${claimId}`);
}
