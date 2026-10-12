import { TOOLTIP_STYLE } from './chartTheme';

interface TooltipPayloadItem {
  name?: string;
  value?: unknown;
  color?: string;
  dataKey?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export interface ChartTooltipContentProps {
  active?: boolean;
  /** Readonly: matches recharts' `TooltipPayload` array. */
  payload?: readonly TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading =
    label !== undefined && labelFormatter ? labelFormatter(label) : String(label ?? '');

  return (
    <div style={TOOLTIP_STYLE}>
      {heading && (
        <p className="mb-1 text-label-md font-medium text-on-surface-variant">{heading}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry, index) => {
          const rawValue = entry.value;
          const numericValue =
            typeof rawValue === 'number'
              ? rawValue
              : typeof rawValue === 'string'
                ? Number(rawValue)
                : 0;
          const name = entry.name ?? entry.dataKey ?? `Series ${index + 1}`;
          const displayValue = valueFormatter
            ? valueFormatter(numericValue, name)
            : String(rawValue ?? '');
          return (
            <li
              key={`${entry.dataKey ?? name}-${index}`}
              className="flex items-center gap-2 text-body-sm"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color ?? '#64748B' }}
              />
              <span className="text-on-surface-variant">{name}</span>
              <span className="ml-auto font-semibold text-on-surface">{displayValue}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
