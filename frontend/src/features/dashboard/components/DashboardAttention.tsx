import { Icon } from '../../../components/ui/Icon';
import { cn } from '../../../utils/cn';

export type AttentionTone = 'warning' | 'error';

export interface AttentionChip {
  id: string;
  tone: AttentionTone;
  icon: string;
  label: string;
  value: string;
  onSelect: () => void;
}

export interface DashboardAttentionProps {
  chips: AttentionChip[];
}

const TONE_CLASSES: Record<AttentionTone, string> = {
  warning: 'bg-warning-container text-on-warning-container hover:bg-warning-container/80',
  error: 'bg-error-container text-on-error-container hover:bg-error-container/80',
};

export function DashboardAttention({ chips }: DashboardAttentionProps) {
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            onClick={chip.onSelect}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              TONE_CLASSES[chip.tone],
            )}
          >
            <Icon name={chip.icon} size={14} />
            <span>{chip.label}</span>
            <span className="font-semibold tabular-nums">{chip.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
