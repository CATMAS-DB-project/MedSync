import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_STYLE, CHART_COLORS, formatCompact } from './chartTheme';
import { ChartTooltipContent } from './ChartTooltip';
import type { ChartTooltipContentProps } from './ChartTooltip';

export interface RankedBarItem {
  label: string;
  value: number;
  color?: string;
}

export interface RankedBarChartProps {
  data: RankedBarItem[];
  valueFormatter?: (value: number) => string;
  color?: string;
  height?: number;
  ariaSummary?: string;
}

function truncate(s: string, max = 24): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function RankedBarChart({
  data,
  valueFormatter,
  color = CHART_COLORS.primary,
  height = 280,
  ariaSummary,
}: RankedBarChartProps) {
  const barHeight = 28;
  const computedHeight = Math.max(height, data.length * barHeight + 40);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      role="img"
      aria-label={ariaSummary ?? 'Ranked bar chart'}
      style={{ width: '100%', height: computedHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
        >
          <XAxis type="number" hide domain={[0, maxValue * 1.1]} />
          <YAxis
            type="category"
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={140}
            tickFormatter={(v) => truncate(String(v))}
          />
          <Tooltip
            cursor={{ fill: 'rgba(46, 107, 230, 0.06)' }}
            content={(props) => (
              <ChartTooltipContent
                {...(props as unknown as ChartTooltipContentProps)}
                valueFormatter={(v, name) =>
                  valueFormatter ? valueFormatter(v) : `${name}: ${formatCompact(v)}`
                }
              />
            )}
          />
          <Bar
            dataKey="value"
            radius={[6, 6, 6, 6]}
            isAnimationActive
            animationDuration={500}
            label={{
              position: 'right',
              formatter: (value: unknown) => {
                const n = typeof value === 'number' ? value : Number(value);
                if (!Number.isFinite(n)) return '';
                return valueFormatter ? valueFormatter(n) : formatCompact(n);
              },
              fill: '#0F1E3D',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry.label}-${index}`}
                fill={entry.color ?? color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
