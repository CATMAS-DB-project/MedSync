import { useEffect, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { ApiError } from '../../../services/api/ApiError';
import {
  createInsuranceClaim,
  verifyInsuranceClaim,
} from '../../../services/api/insuranceClaims';
import { formatCurrency } from '../../../utils/formatters';
import type {
  ClaimVerificationStatus,
  InsuranceClaim,
  InsurancePolicy,
  InvoiceDetail,
} from '../../../types';

export interface InvoiceClaimsSectionProps {
  invoice: InvoiceDetail;
  claim: InsuranceClaim | null;
  activePolicies: InsurancePolicy[];
  isReceptionist: boolean;
  onChanged: () => void;
}

const CLAIM_TONE: Record<ClaimVerificationStatus, 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

export function InvoiceClaimsSection({
  invoice,
  claim,
  activePolicies,
  isReceptionist,
  onChanged,
}: InvoiceClaimsSectionProps) {
  const toast = useToast();
  const [policyId, setPolicyId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [isPending, setIsPending] = useState<'claim' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPolicyId(activePolicies[0]?.policyId ?? '');
    setClaimAmount(String(invoice.subtotalAmount));
    setError(null);
  }, [invoice.invoiceId, invoice.subtotalAmount, activePolicies]);

  const handleCreate = async () => {
    if (isPending) return;
    const amount = Number(claimAmount);
    if (!policyId) {
      setError('Choose an active insurance policy.');
      return;
    }
    if (!(amount > 0) || amount > invoice.subtotalAmount) {
      setError(
        `Claimed amount must be between 0.01 and ${formatCurrency(invoice.subtotalAmount)}.`,
      );
      return;
    }
    setIsPending('claim');
    setError(null);
    try {
      await createInsuranceClaim(invoice.invoiceId, {
        policyId,
        claimedAmount: amount,
      });
      toast.success('Insurance claim submitted');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the claim.');
    } finally {
      setIsPending(null);
    }
  };

  const handleVerify = async () => {
    if (!claim || isPending) return;
    setIsPending('verify');
    setError(null);
    try {
      await verifyInsuranceClaim(claim.claimId);
      toast.success('Insurance claim verified');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the claim.');
    } finally {
      setIsPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        Insurance claim
      </h3>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {claim ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-label-md text-on-surface-variant">
              {claim.policyId}
            </span>
            <Badge tone={CLAIM_TONE[claim.verificationStatus]} dot pill>
              {claim.verificationStatus}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-body-sm">
            <div>
              <div className="text-label-md text-on-surface-variant">Claimed</div>
              <div className="font-medium text-on-surface">
                {formatCurrency(claim.claimedAmount)}
              </div>
            </div>
            {claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div>
                <div className="text-label-md text-on-surface-variant">Approved</div>
                <div className="font-medium text-on-surface">
                  {formatCurrency(Number(claim.approvedAmount))}
                </div>
              </div>
            )}
          </div>

          {isReceptionist && claim.verificationStatus === 'Pending' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleVerify}
              isLoading={isPending === 'verify'}
              disabled={isPending !== null}
            >
              Verify claim
            </Button>
          )}
        </div>
      ) : isReceptionist ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4">
          <Select
            label="Policy"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            options={activePolicies.map((p) => ({
              label: `${p.providerName} (${p.policyId})`,
              value: p.policyId,
            }))}
            placeholder="Select a policy"
          />
          <Input
            label="Claimed amount"
            type="number"
            min="0"
            step="0.01"
            value={claimAmount}
            onChange={(e) => setClaimAmount(e.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreate}
            isLoading={isPending === 'claim'}
            disabled={isPending !== null || activePolicies.length === 0}
          >
            Create claim
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
          No claim
        </div>
      )}
    </div>
  );
}
