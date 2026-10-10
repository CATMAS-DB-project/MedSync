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

const ACCENT_TONE_CLASSES: Record<KpiIconTone, string> = {
  primary: 'from-primary to-primary-fixed',
  error: 'from-error to-error-container',
  secondary: 'from-secondary to-secondary-fixed',
  success: 'from-green-700 to-green-300',
  warning: 'from-amber-700 to-amber-300',
  teal: 'from-teal-700 to-teal-300',
  purple: 'from-purple-700 to-purple-300',
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
    ? {
        type: 'button' as const,
        onClick,
        className: 'group w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      }
    : { className: '' };

  return (
    <Wrapper {...wrapperProps}>
      <div
        className={[
          'relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-elevated transition-all',
          onClick ? 'cursor-pointer group-hover:-translate-y-0.5 group-hover:shadow-lg' : '',
        ].join(' ')}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENT_TONE_CLASSES[iconTone]}`} />
        <div className="flex items-start justify-between gap-3 pt-1">
          <h3 className="text-label-md text-on-surface-variant uppercase tracking-wide">{label}</h3>
          <span className={`shrink-0 rounded-lg p-2 ${ICON_TONE_CLASSES[iconTone]}`}>
            <Icon name={icon} size={18} />
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-on-surface tabular-nums">{value}</span>
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
