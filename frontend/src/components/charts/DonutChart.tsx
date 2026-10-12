import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS, formatPercent } from './chartTheme';
import { ChartTooltipContent } from './ChartTooltip';
import type { ChartTooltipContentProps } from './ChartTooltip';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  ariaSummary?: string;
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  valueFormatter,
  height = 280,
  ariaSummary,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colored = data.map((d, i) => ({
    ...d,
    color: d.color ?? [CHART_COLORS.primary, CHART_COLORS.secondary][i % 2],
  }));

  return (
    <div
      role="img"
      aria-label={ariaSummary ?? 'Donut chart'}
      style={{ width: '100%' }}
    >
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={(props) => (
                <ChartTooltipContent
                  {...(props as unknown as ChartTooltipContentProps)}
                  valueFormatter={(v, name) =>
                    valueFormatter ? valueFormatter(v) : `${name}: ${v}`
                  }
                />
              )}
            />
            <Pie
              data={colored}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="#FFFFFF"
              strokeWidth={2}
              isAnimationActive
              animationDuration={500}
            >
              {colored.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-display-sm font-bold text-on-surface">{centerValue}</span>
          <span className="text-label-md text-on-surface-variant">{centerLabel}</span>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {colored.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <li
              key={entry.label}
              className="flex items-center gap-2 text-body-sm"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-on-surface">{entry.label}</span>
              <span className="ml-auto tabular-nums text-on-surface">
                {valueFormatter ? valueFormatter(entry.value) : entry.value}
              </span>
              <span className="w-12 text-right tabular-nums text-on-surface-variant">
                {formatPercent(pct, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
