import { cn } from '../../utils/cn';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, onDismiss, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-2xl bg-error-container px-4 py-3 text-on-error-container',
        className,
      )}
    >
      <Icon name="error" size={20} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-body-sm">{message}</p>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="text-on-error-container hover:bg-white/40">
            Retry
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-error-container"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}