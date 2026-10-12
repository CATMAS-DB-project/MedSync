import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { useBranchNames } from '../../../hooks/useBranchNames';
import { fetchPatientById } from '../../../services/api/patients';
import { fetchInsuranceClaims } from '../../../services/api/insuranceClaims';
import {
  fetchInvoiceById,
  fetchInvoicePayments,
} from '../../../services/api/invoices';
import { formatDate, formatFullName } from '../../../utils/formatters';
import { INVOICE_STATUS_TONE } from '../statusStyles';
import { InvoiceItemsTable } from './InvoiceItemsTable';
import { InvoiceTotals } from './InvoiceTotals';
import { InvoicePaymentsList } from './InvoicePaymentsList';
import { InvoiceClaimsSection } from './InvoiceClaimsSection';
import { InvoiceFinalizeForm } from './InvoiceFinalizeForm';
import { InvoicePaymentForm } from './InvoicePaymentForm';
import { ReceiptModal } from './ReceiptModal';
import type { InsuranceClaim, Payment } from '../../../types';

export interface InvoiceDetailDrawerProps {
  invoiceId: number | null;
  onClose: () => void;
  onChanged: () => void;
  initialFocus?: 'finalize' | 'payment' | null;
}

export function InvoiceDetailDrawer({
  invoiceId,
  onClose,
  onChanged,
  initialFocus = null,
}: InvoiceDetailDrawerProps) {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const isReceptionist = role === 'Receptionist';
  const canSeePayments = role === 'Receptionist' || role === 'Admin';
  const { getBranchName } = useBranchNames(invoiceId !== null);

  const invoiceQuery = useAsync(
    () => (invoiceId === null ? Promise.resolve(null) : fetchInvoiceById(invoiceId)),
    [invoiceId],
  );
  const invoice =
    invoiceId !== null && invoiceQuery.data?.invoiceId === invoiceId
      ? invoiceQuery.data
      : null;

  const patient = useAsync(
    () =>
      invoice?.patientId ? fetchPatientById(invoice.patientId) : Promise.resolve(null),
    [invoice?.patientId],
  );

  const payments = useAsync(
    () =>
      canSeePayments && invoiceId !== null
        ? fetchInvoicePayments(invoiceId)
        : Promise.resolve([] as Payment[]),
    [invoiceId, canSeePayments],
  );

  // The backend has no invoice filter on this endpoint; scope by branchId for Receptionist.
  const claims = useAsync(
    () =>
      !isReceptionist || !invoice
        ? Promise.resolve(null)
        : fetchInsuranceClaims({ branchId: invoice.branchId, pageSize: 100 }),
    [isReceptionist, invoice?.invoiceId, invoice?.branchId],
  );
  const claim: InsuranceClaim | null =
    claims.data?.items.find((c) => c.invoiceId === invoiceId) ?? null;

  const activePolicies = useMemo(
    () => (patient.data?.insurance ?? []).filter((p) => p.status === 'Active'),
    [patient.data?.insurance],
  );

  const approvedInsuranceAmount =
    claim?.verificationStatus === 'Approved'
      ? Number(claim.approvedAmount ?? 0)
      : 0;

  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  // Reset the receipt when the invoice changes.
  useEffect(() => {
    setReceiptPayment(null);
  }, [invoiceId]);

  const handleChanged = () => {
    invoiceQuery.reload();
    payments.reload();
    claims.reload();
    onChanged();
  };

  const patientName =
    invoice?.patientName ??
    (patient.data
      ? formatFullName(patient.data.firstName, patient.data.lastName)
      : null) ??
    (invoice?.patientId !== undefined ? `Patient #${invoice.patientId}` : 'Patient');

  const resolvedBranchName = invoice
    ? invoice.branchName ?? getBranchName(invoice.branchId)
    : undefined;

  return (
    <>
      <Modal
        isOpen={invoiceId !== null}
        onClose={onClose}
        title={invoiceId !== null ? `Invoice #${invoiceId}` : 'Invoice'}
        size="xl"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        {invoiceQuery.isLoading && !invoice && (
          <div className="flex flex-col gap-4">
            <Skeleton height={64} rounded="xl" />
            <Skeleton height={200} rounded="xl" />
            <Skeleton height={120} rounded="xl" />
          </div>
        )}

        {invoiceQuery.error && (
          <ErrorBanner message={invoiceQuery.error} onRetry={invoiceQuery.reload} />
        )}

        {invoice && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot pill>
                  {invoice.status}
                </Badge>
                <span className="text-label-md text-on-surface-variant">
                  Created {formatDate(invoice.createdAt)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon="print"
                onClick={() => window.print()}
                className="no-print"
              >
                Print
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
                  <Avatar name={patientName} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-body-md font-semibold text-on-surface">
                      {patientName}
                    </div>
                    {patient.data && (
                      <div className="truncate text-label-md text-on-surface-variant">
                        {patient.data.nicPassportNo}
                      </div>
                    )}
                    {resolvedBranchName && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-label-md text-on-surface-variant">
                        <Icon name="location_on" size={12} />
                        {resolvedBranchName}
                      </div>
                    )}
                  </div>
                </div>

                <InvoiceItemsTable lineItems={invoice.lineItems} />

                <InvoiceTotals invoice={invoice} />

                {canSeePayments && (
                  <InvoicePaymentsList
                    payments={payments.data ?? []}
                    loading={payments.isLoading}
                    error={payments.error}
                    onRetry={payments.reload}
                    onOpenReceipt={setReceiptPayment}
                  />
                )}

                {isReceptionist && (
                  <InvoiceClaimsSection
                    invoice={invoice}
                    claim={claim}
                    activePolicies={activePolicies}
                    isReceptionist={isReceptionist}
                    onChanged={handleChanged}
                  />
                )}
              </div>

              <aside className="no-print flex flex-col gap-4">
                {!isReceptionist && (
                  <div className="rounded-2xl bg-surface-container-low p-3 text-label-md text-on-surface-variant">
                    Read-only
                  </div>
                )}

                {isReceptionist && invoice.status === 'Draft' && (
                  <InvoiceFinalizeForm
                    invoice={invoice}
                    approvedInsuranceAmount={approvedInsuranceAmount}
                    onSuccess={handleChanged}
                    autoFocus={initialFocus === 'finalize'}
                  />
                )}

                {isReceptionist &&
                  (invoice.status === 'Finalized' ||
                    invoice.status === 'Partially Paid') && (
                    <InvoicePaymentForm
                      invoice={invoice}
                      onSuccess={(payment) => {
                        handleChanged();
                        setReceiptPayment(payment);
                      }}
                      autoFocus={initialFocus === 'payment'}
                    />
                  )}

                {isReceptionist && invoice.status === 'Paid' && (
                  <div className="flex flex-col items-start gap-2 rounded-2xl bg-success-container/50 p-4 text-body-sm text-on-success-container">
                    <Badge tone="success" dot pill>
                      Paid
                    </Badge>
                    <span>Fully settled</span>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </Modal>

      <ReceiptModal
        payment={receiptPayment}
        invoiceId={invoice?.invoiceId ?? null}
        patientName={patientName}
        onClose={() => setReceiptPayment(null)}
      />
    </>
  );
}
