import type { CSSProperties } from 'react';

export const CHART_COLORS = {
  primary: '#2E6BE6',
  secondary: '#0D9488',
  tertiary: '#D97706',
  violet: '#8B5CF6',
  rose: '#E11D48',
  slate: '#64748B',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
} as const;

export const AXIS_STYLE = {
  fontSize: 11,
  fill: '#4A5878',
  fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
} as const;

export const GRID_STYLE = {
  stroke: '#E1E7F0',
  strokeDasharray: '4 4',
  vertical: false,
} as const;

export const TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 12,
  border: '1px solid #E1E7F0',
  boxShadow:
    '0 4px 12px rgba(15, 30, 61, 0.08), 0 12px 32px rgba(15, 30, 61, 0.08)',
  padding: '8px 10px',
  background: '#FFFFFF',
  fontSize: 12,
  color: '#0F1E3D',
};


export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

export interface TopNResult<T> {
  items: T[];
  hasOther: boolean;
  otherValue: number;
}

export function topNWithOther<T>(
  items: T[],
  n: number,
  getValue: (item: T) => number,
  makeOther: (rest: T[], otherSum: number) => T,
): TopNResult<T> {
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  if (sorted.length <= n) {
    return { items: sorted, hasOther: false, otherValue: 0 };
  }
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const otherSum = rest.reduce((sum, item) => sum + getValue(item), 0);
  return {
    items: [...top, makeOther(rest, otherSum)],
    hasOther: true,
    otherValue: otherSum,
  };
}
