import { apiGet, apiPost } from './client';
import type { ClaimVerificationStatus, InsuranceClaim, PagedResult } from '../../types';

export interface InsuranceClaimListParams
  extends Record<string, string | number | boolean | undefined> {
  status?: ClaimVerificationStatus;
  branchId?: number;
  page?: number;
  pageSize?: number;
}

function toClaim(raw: InsuranceClaim): InsuranceClaim {
  return {
    ...raw,
    claimedAmount: Number(raw.claimedAmount),
    approvedAmount:
      raw.approvedAmount === null || raw.approvedAmount === undefined
        ? raw.approvedAmount
        : Number(raw.approvedAmount),
  };
}

export async function fetchInsuranceClaims(
  params?: InsuranceClaimListParams,
): Promise<PagedResult<InsuranceClaim>> {
  const queryParams = params as Record<string, unknown> | undefined;
  const result = await apiGet<PagedResult<InsuranceClaim>>('/insurance-claims', queryParams);
  return { ...result, items: result.items.map(toClaim) };
}

export async function createInsuranceClaim(
  invoiceId: number,
  input: {
    policyId: string;
    claimedAmount: number;
  },
): Promise<InsuranceClaim> {
  return toClaim(await apiPost<InsuranceClaim>(`/invoices/${invoiceId}/claim`, input));
}

/**
 * POST /insurance-claims/{id}/verify takes NO body: the backend (currently a mock
 * insurer) decides the outcome and returns the updated claim.
 */
export async function verifyInsuranceClaim(claimId: number): Promise<InsuranceClaim> {
  return toClaim(await apiPost<InsuranceClaim>(`/insurance-claims/${claimId}/verify`));
}

export async function fetchInsuranceClaimById(claimId: number): Promise<InsuranceClaim> {
  return toClaim(await apiGet<InsuranceClaim>(`/insurance-claims/${claimId}`));
}
