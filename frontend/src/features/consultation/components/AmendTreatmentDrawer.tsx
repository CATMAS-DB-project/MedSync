import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Select } from '../../../components/ui/Select';
import { TextArea } from '../../../components/ui/TextArea';
import { ApiError } from '../../../services/api/ApiError';
import { amendAppointmentTreatment } from '../../../services/api/appointmentTreatments';
import { formatCurrency } from '../../../utils/formatters';
import type { AppointmentTreatment, TreatmentCatalogueItem } from '../../../types';

export interface AmendTreatmentDrawerProps {
  record: AppointmentTreatment | null;
  catalogue: TreatmentCatalogueItem[];
  onClose: () => void;
  onAmended: () => void;
}

export function AmendTreatmentDrawer({ record, catalogue, onClose, onAmended }: AmendTreatmentDrawerProps) {
  const [serviceCode, setServiceCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    setServiceCode(record?.serviceCode ?? '');
    setReason('');
    setError(null);
  }, [record]);

  async function handleSubmit() {
    if (!record) return;
    if (!serviceCode) {
      setError('Choose the correct treatment.');
      return;
    }
    if (!reason.trim()) {
      setError('An amendment reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await amendAppointmentTreatment(record.appointmentTreatmentId, {
        service_code: serviceCode,
        amendment_reason: reason.trim(),
      });
      onAmended();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the amendment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      isOpen={record !== null}
      onClose={onClose}
      title="Amend Treatment"
      subtitle={record ? `Correcting: ${record.treatmentName ?? record.serviceCode}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save Amendment'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/30 p-4">
          <span className="shrink-0 rounded-lg bg-surface-container-lowest p-2 text-primary">
            <Icon name="edit_note" size={20} />
          </span>
          <div>
            <p className="text-body-md font-semibold text-on-surface">Correct the treatment record</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              The original record is retained. This amendment creates a linked correction for the audit trail.
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <Select
            label="Correct treatment"
            placeholder="Select treatment"
            options={catalogue.map((item) => ({
              label: `${item.treatmentName} · ${formatCurrency(item.unitPrice)}`,
              value: item.serviceCode,
            }))}
            value={serviceCode}
            onChange={(event) => setServiceCode(event.target.value)}
          />
          <TextArea
            label="Reason for amendment"
            placeholder="e.g. Wrong treatment selected"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={255}
            error={error ?? undefined}
          />
          <p className="-mt-3 text-right text-label-md text-on-surface-variant">
            {reason.length}/255
          </p>
        </div>
      </div>
    </Drawer>
  );
}
