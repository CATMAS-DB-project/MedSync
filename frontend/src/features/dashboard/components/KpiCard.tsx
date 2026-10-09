import { Icon } from '../../../components/ui/Icon';

export type KpiIconTone = 'primary' | 'error' | 'secondary' | 'success' | 'warning' | 'teal' | 'purple';

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  iconTone?: KpiIconTone;
  trend?: string;
  trendPositive?: boolean;
  helperText?: string;
  caption?: string;
  onClick?: () => void;
}

const ICON_TONE_CLASSES: Record<KpiIconTone, string> = {
  primary: 'text-primary bg-primary-fixed',
  error: 'text-error bg-error-container',
  secondary: 'text-secondary bg-secondary-container',
  success: 'text-green-700 bg-green-100',
  warning: 'text-amber-700 bg-amber-100',
  teal: 'text-teal-700 bg-teal-100',
  purple: 'text-purple-700 bg-purple-100',
};

export function KpiCard({
  label,
  value,
  icon,
  iconTone = 'primary',
  trend,
  trendPositive,
  helperText,
  caption,
  onClick,
}: KpiCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? { type: 'button' as const, onClick, className: 'w-full text-left' }
    : { className: '' };

  return (
    <Wrapper {...wrapperProps}>
      <div
        className={[
          'bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-3 h-full',
          onClick ? 'hover:bg-surface-container-low transition-colors cursor-pointer' : '',
        ].join(' ')}
      >
        <div className="flex justify-between items-start">
          <h3 className="text-label-md text-on-surface-variant uppercase tracking-wide">{label}</h3>
          <span className={`rounded p-1.5 shrink-0 ${ICON_TONE_CLASSES[iconTone]}`}>
            <Icon name={icon} size={16} />
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-on-surface tabular-nums">{value}</span>
          {trend && (
            <span
              className={[
                'text-[11px] font-medium px-1.5 py-0.5 rounded',
                trendPositive === true
                  ? 'text-green-700 bg-green-100'
                  : trendPositive === false
                    ? 'text-error bg-error-container'
                    : 'text-secondary bg-secondary-container',
              ].join(' ')}
            >
              {trend}
            </span>
          )}
        </div>

        {helperText && (
          <p className="text-body-sm text-on-surface-variant -mt-1">{helperText}</p>
        )}
        {caption && (
          <p className="text-[11px] text-outline mt-auto">{caption}</p>
        )}
      </div>
    </Wrapper>
  );
}
