import { useEffect, useState } from 'react';
import { Drawer, DrawerSection } from '../../../components/layout/Drawer';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { ApiError } from '../../../services/api/ApiError';
import { fetchPatientInsurance } from '../../../services/api/insurance';
import { createInsuranceClaim, fetchInsuranceClaims, verifyInsuranceClaim } from '../../../services/api/insuranceClaims';
import { fetchInvoiceById, fetchInvoicePayments, finalizeInvoice } from '../../../services/api/invoices';
import { recordPayment } from '../../../services/api/payments';
import { fetchPatientById } from '../../../services/api/patients';
import { formatCurrency, formatDate, formatFullName } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import { useToast } from '../../../components/common/ToastProvider';
import type { ClaimVerificationStatus, PaymentMethod } from '../../../types';

export interface InvoiceDetailDrawerProps {
  invoiceId: number | null;
  onClose: () => void;
  /** Called after any change so the list behind the drawer refreshes. */
  onChanged: () => void;
}

const CLAIM_TONE: Record<ClaimVerificationStatus, 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

const METHOD_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'Cash' },
  { label: 'Credit Card', value: 'Credit Card' },
  { label: 'Insurance', value: 'Insurance' },
];

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function InvoiceDetailDrawer({ invoiceId, onClose, onChanged }: InvoiceDetailDrawerProps) {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const toast = useToast();
  // Backend: only Receptionists act on invoices; payment history is visible to Receptionist/Admin.
  const isReceptionist = role === 'Receptionist';
  const canSeePayments = role === 'Receptionist' || role === 'Admin';

  const invoiceQuery = useAsync(
    () => (invoiceId === null ? Promise.resolve(null) : fetchInvoiceById(invoiceId)),
    [invoiceId],
  );
  const invoice = invoiceId !== null && invoiceQuery.data?.invoiceId === invoiceId ? invoiceQuery.data : null;

  const patient = useAsync(
    () => (invoice?.patientId ? fetchPatientById(invoice.patientId) : Promise.resolve(null)),
    [invoice?.patientId],
  );
  const policies = useAsync(
    () =>
      isReceptionist && invoice?.patientId
        ? fetchPatientInsurance(invoice.patientId)
        : Promise.resolve([]),
    [invoice?.patientId, isReceptionist],
  );
  const payments = useAsync(
    () => (canSeePayments && invoiceId !== null ? fetchInvoicePayments(invoiceId) : Promise.resolve([])),
    [invoiceId, canSeePayments],
  );
  // The backend has no "claim for invoice X" endpoint yet, so look it up in the claims list.
  const claims = useAsync(
    () => (invoiceId !== null ? fetchInsuranceClaims({ pageSize: 100 }) : Promise.resolve(null)),
    [invoiceId],
  );
  const claim = claims.data?.items.find((c) => c.invoiceId === invoiceId) ?? null;
  const activePolicies = (policies.data ?? []).filter((p) => p.status === 'Active');

  // Form state
  const [policyId, setPolicyId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [insuranceDeduction, setInsuranceDeduction] = useState('0');
  const [manualDiscount, setManualDiscount] = useState('0');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approvedAmount = claim?.verificationStatus === 'Approved' ? Number(claim.approvedAmount ?? 0) : 0;

  // Reset the forms whenever a different invoice (or a new state of it) is shown.
  useEffect(() => {
    setError(null);
    setPolicyId(activePolicies[0]?.policyId ?? '');
    setClaimAmount(invoice ? String(invoice.subtotalAmount) : '');
    setInsuranceDeduction(approvedAmount > 0 ? String(approvedAmount) : '0');
    setManualDiscount('0');
    setPayAmount(invoice?.outstandingAmount ? String(invoice.outstandingAmount) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.invoiceId, invoice?.status, invoice?.outstandingAmount, claim?.verificationStatus, policies.data]);

  function refreshAll() {
    invoiceQuery.reload();
    payments.reload();
    claims.reload();
    onChanged();
  }

  async function run(label: string, action: () => Promise<unknown>, fallback: string) {
    setBusy(label);
    setError(null);
    try {
      await action();
      const successMessage =
        label === 'payment'
          ? 'Payment recorded successfully.'
          : label === 'finalize'
            ? 'Invoice finalized successfully.'
            : label === 'verify'
              ? 'Insurance claim verified successfully.'
              : label === 'claim'
                ? 'Insurance claim submitted successfully.'
                : 'Action completed successfully.';
      toast.success(successMessage);
      refreshAll();
    } catch (err) {
      setError(messageOf(err, fallback));
    } finally {
      setBusy(null);
    }
  }

  function submitClaim() {
    if (!invoice) return;
    const amount = Number(claimAmount);
    if (!policyId) return setError('Choose an active insurance policy.');
    if (!(amount > 0) || amount > invoice.subtotalAmount)
      return setError(`Claimed amount must be between 0.01 and ${formatCurrency(invoice.subtotalAmount)}.`);
    void run('claim', () => createInsuranceClaim(invoice.invoiceId, { policyId, claimedAmount: amount }), 'Could not create the claim.');
  }

  function submitFinalize() {
    if (!invoice) return;
    const ins = Number(insuranceDeduction) || 0;
    const disc = Number(manualDiscount) || 0;
    if (ins < 0 || disc < 0) return setError('Amounts cannot be negative.');
    if (ins > approvedAmount) return setError('Insurance deduction cannot exceed the approved claim amount.');
    if (ins + disc > invoice.subtotalAmount) return setError('Deductions and discount cannot exceed the subtotal.');
    if (!window.confirm('Finalize this invoice? Amounts cannot be changed afterwards.')) return;
    void run('finalize', () => finalizeInvoice(invoice.invoiceId, { insuranceDeduction: ins, manualDiscount: disc }), 'Could not finalize the invoice.');
  }

  function submitPayment() {
    if (!invoice) return;
    const amount = Number(payAmount);
    const outstanding = invoice.outstandingAmount ?? 0;
    if (!(amount > 0)) return setError('Enter a payment amount greater than zero.');
    if (round2(amount) > round2(outstanding)) return setError(`Payment cannot exceed the outstanding balance (${formatCurrency(outstanding)}).`);
    void run('payment', () => recordPayment(invoice.invoiceId, { amountPaid: round2(amount), paymentMethod: payMethod }), 'Could not record the payment.');
  }

  const patientName = patient.data ? formatFullName(patient.data.firstName, patient.data.lastName) : undefined;
  const previewPayable = invoice
    ? round2(invoice.subtotalAmount - (Number(insuranceDeduction) || 0) - (Number(manualDiscount) || 0))
    : 0;

  return (
    <Drawer
      isOpen={invoiceId !== null}
      onClose={onClose}
      title={invoiceId !== null ? `Invoice #${invoiceId}` : ''}
      subtitle={patientName}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {invoiceQuery.isLoading && !invoice && <p className="text-body-sm text-on-surface-variant">Loading invoice…</p>}
      {invoiceQuery.error && <p className="text-body-sm text-error">{invoiceQuery.error}</p>}
      {error && (
        <div className="rounded border border-error/40 bg-error/10 p-3 text-body-sm text-error">{error}</div>
      )}

      {invoice && (
        <>
          <DrawerSection title="Summary" icon="receipt_long">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <div className="text-on-surface-variant text-label-md">Visit date</div>
                <div className="text-on-surface">{formatDate(invoice.appointmentDate)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Status</div>
                <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Subtotal</div>
                <div className="text-on-surface">{formatCurrency(invoice.subtotalAmount)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Insurance deduction</div>
                <div className="text-on-surface">{formatCurrency(invoice.insuranceDeduction)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Manual discount</div>
                <div className="text-on-surface">{formatCurrency(invoice.manualDiscount)}</div>
              </div>
              <div>
                <div className="text-on-surface-variant text-label-md">Payable</div>
                <div className="text-on-surface font-semibold">
                  {formatCurrency(invoice.payableAmount ?? invoice.subtotalAmount)}
                </div>
              </div>
              {invoice.status !== 'Draft' && (
                <>
                  <div>
                    <div className="text-on-surface-variant text-label-md">Paid</div>
                    <div className="text-on-surface">{formatCurrency(invoice.amountPaid ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-on-surface-variant text-label-md">Outstanding</div>
                    <div className="text-on-surface font-semibold">{formatCurrency(invoice.outstandingAmount ?? 0)}</div>
                  </div>
                </>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Visit Charges" icon="list_alt">
            {invoice.lineItems.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                No treatments logged. The subtotal is the consultation fee.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-body-sm">
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.appointmentTreatmentId} className="border-b border-outline-variant">
                      <td className="py-1.5">
                        {item.treatmentName}
                        <span className="block text-label-md text-on-surface-variant">
                          {item.serviceCode}
                          {item.isAmended ? ' · amendment' : ''}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(item.priceAtTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DrawerSection>

          <DrawerSection title="Insurance Claim" icon="health_and_safety">
            {claim ? (
              <div className="flex flex-col gap-2 text-body-sm">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface">
                    Policy <span className="font-mono text-xs">{claim.policyId}</span>
                  </span>
                  <Badge tone={CLAIM_TONE[claim.verificationStatus]}>{claim.verificationStatus}</Badge>
                </div>
                <div className="text-on-surface-variant">
                  Claimed {formatCurrency(claim.claimedAmount)}
                  {claim.approvedAmount != null && ` · Approved ${formatCurrency(Number(claim.approvedAmount))}`}
                </div>
                {isReceptionist && claim.verificationStatus === 'Pending' && (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void run(
                          'verify',
                          () => verifyInsuranceClaim(claim.claimId),
                          'Could not verify the insurance claim.',
                        )
                      }
                      disabled={busy !== null}
                    >
                      {busy === 'verify' ? 'Verifying…' : 'Verify Claim'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Select
                  label="Policy"
                  placeholder="Choose an active insurance policy"
                  options={activePolicies.map((policy) => ({
                    label: `${policy.providerName} (${policy.policyId})`,
                    value: policy.policyId,
                  }))}
                  value={policyId}
                  onChange={(event) => setPolicyId(event.target.value)}
                />
                <Input
                  label="Claim Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={claimAmount}
                  onChange={(event) => setClaimAmount(event.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={submitClaim}
                  disabled={!isReceptionist || busy !== null}
                >
                  {busy === 'claim' ? 'Submitting…' : 'Create Claim'}
                </Button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Finalize Invoice" icon="done_all">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Insurance deduction"
                type="number"
                min="0"
                step="0.01"
                value={insuranceDeduction}
                onChange={(event) => setInsuranceDeduction(event.target.value)}
              />
              <Input
                label="Manual discount"
                type="number"
                min="0"
                step="0.01"
                value={manualDiscount}
                onChange={(event) => setManualDiscount(event.target.value)}
              />
            </div>
            <div className="mt-2 text-body-sm text-on-surface-variant">
              Preview payable: <span className="font-medium text-on-surface">{formatCurrency(previewPayable)}</span>
            </div>
            <Button
              variant="primary"
              onClick={submitFinalize}
              disabled={!isReceptionist || busy !== null || invoice.status === 'Paid'}
              className="mt-3"
            >
              {busy === 'finalize' ? 'Finalizing…' : 'Finalize Invoice'}
            </Button>
          </DrawerSection>

          <DrawerSection title="Record Payment" icon="payments">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
              <Select
                label="Method"
                options={METHOD_OPTIONS}
                value={payMethod}
                onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
              />
            </div>
            <Button
              variant="primary"
              onClick={submitPayment}
              disabled={!isReceptionist || busy !== null}
              className="mt-3"
            >
              {busy === 'payment' ? 'Recording…' : 'Record Payment'}
            </Button>
          </DrawerSection>

          {payments.data && payments.data.length > 0 && (
            <DrawerSection title="Payment History" icon="history">
              <div className="space-y-2">
                {payments.data.map((payment) => (
                  <div key={payment.paymentId} className="rounded border border-outline-variant p-2 text-body-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-on-surface">{formatCurrency(payment.amountPaid)}</span>
                      <Badge tone="primary">{payment.paymentMethod}</Badge>
                    </div>
                    <div className="mt-1 text-on-surface-variant">
                      {formatDate(payment.paymentDate)} · {payment.processedByStaffId ? `Staff #${payment.processedByStaffId}` : 'Manual'}
                    </div>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}
