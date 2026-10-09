import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorBanner({ message, onRetry, retryLabel = 'Retry', className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-l-4 border-error bg-error-container px-4 py-3 text-body-sm text-on-error-container',
        className,
      )}
    >
      <span>{message}</span>
      {onRetry && (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="text-on-error-container underline hover:bg-transparent">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
