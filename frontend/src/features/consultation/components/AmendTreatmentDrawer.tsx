import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/layout/Drawer';
import { Button } from '../../../components/ui/Button';
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
      <p className="text-body-sm text-on-surface-variant">
        Treatment records are never deleted. An amendment adds a correction record linked to the original.
      </p>
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
    </Drawer>
  );
}
