import { Icon } from '../../../components/ui/Icon';

export interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  iconTone?: 'primary' | 'error' | 'secondary';
  trend?: string;
  helperText?: string;
}

const ICON_TONE_CLASSES: Record<NonNullable<KpiCardProps['iconTone']>, string> = {
  primary: 'text-primary bg-primary-fixed',
  error: 'text-error bg-error-container',
  secondary: 'text-secondary bg-secondary-container',
};

export function KpiCard({
  label,
  value,
  icon,
  iconTone = 'primary',
  trend,
  helperText,
}: KpiCardProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-label-md text-on-surface-variant uppercase tracking-wide">{label}</h3>
        <span className={`rounded p-1 ${ICON_TONE_CLASSES[iconTone]}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-display-sm font-bold text-on-surface">{value}</span>
        {trend && (
          <span className="text-body-sm text-secondary bg-secondary-container px-1.5 rounded text-[11px] font-medium">
            {trend}
          </span>
        )}
        {helperText && (
          <span className="text-on-surface-variant text-[11px]">{helperText}</span>
        )}
      </div>
    </div>
  );
}
