import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_STYLE,
  CHART_COLORS,
  GRID_STYLE,
  formatCompact,
} from './chartTheme';
import { ChartTooltipContent } from './ChartTooltip';
import type { ChartTooltipContentProps } from './ChartTooltip';

export interface TrendSeries {
  key: string;
  label: string;
  color?: string;
}

export interface TrendChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: TrendSeries[];
  stacked?: boolean;
  allowDecimals?: boolean;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string | number) => string;
  height?: number;
  ariaSummary?: string;
}

export function TrendChart({
  data,
  xKey,
  series,
  stacked = false,
  allowDecimals = false,
  valueFormatter,
  labelFormatter,
  height = 280,
  ariaSummary,
}: TrendChartProps) {
  return (
    <div
      role="img"
      aria-label={ariaSummary ?? 'Trend chart'}
      style={{ width: '100%', height }}
    >
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap items-center gap-3">
          {series.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-1.5 text-label-md text-on-surface-variant"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color ?? CHART_COLORS.primary }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <ResponsiveContainer width="100%" height={series.length > 1 ? height - 22 : height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => {
              const color = s.color ?? CHART_COLORS.primary;
              return (
                <linearGradient
                  key={s.key}
                  id={`trend-gradient-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={stacked ? 0.35 : 0.12} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={labelFormatter ? (v) => String(labelFormatter(v)) : undefined}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={allowDecimals}
            domain={[0, 'auto']}
            tickFormatter={(v) => {
              const num = Number(v);
              if (!allowDecimals && !Number.isInteger(num)) return '';
              return valueFormatter ? valueFormatter(num) : formatCompact(num);
            }}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltipContent
                {...(props as unknown as ChartTooltipContentProps)}
                labelFormatter={labelFormatter}
                valueFormatter={(v, name) =>
                  valueFormatter ? valueFormatter(v) : `${name}: ${formatCompact(v)}`
                }
              />
            )}
          />
          {series.map((s) => {
            const color = s.color ?? CHART_COLORS.primary;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                fill={`url(#trend-gradient-${s.key})`}
                stackId={stacked ? 'stack' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={500}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
