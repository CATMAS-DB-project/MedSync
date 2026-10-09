import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" aria-modal="true" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-5 shadow-xl">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        <p className="mt-2 text-body-sm text-on-surface-variant">{message}</p>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            autoFocus
            className={cn(tone === 'danger' && 'bg-error text-on-error')}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
