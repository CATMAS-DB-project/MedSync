import { cn } from '../../utils/cn';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-surface-container-low p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-8 select-none items-center gap-1.5 rounded-lg px-3 text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-low',
              active
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
              item.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentedControlProps<T extends string = string> extends TabsProps<T> {}

export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  return <Tabs {...props} />;
}