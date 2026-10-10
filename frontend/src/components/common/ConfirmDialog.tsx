import { Modal } from './Modal';
import { Button } from '../ui/Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  tone?: 'danger' | 'default';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isPending = false,
  tone = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? () => undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isPending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body-sm text-on-surface-variant">{message}</p>
    </Modal>
  );
}