import { StatCard } from '../../../components/ui/StatCard';
import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';

export interface StatDelta {
  value: string;
  direction: 'up' | 'down' | 'flat';
}

export interface DashboardKpiItem {
  key: string;
  label: string;
  icon: string;
  value: string;
  description?: string;
  delta?: StatDelta;
  loading: boolean;
  hasData: boolean;
  error: string | null;
  onClick: () => void;
  onRetry: () => void;
}

export interface DashboardKpisProps {
  items: DashboardKpiItem[];
}

export function DashboardKpis({ items }: DashboardKpisProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KpiSlot key={item.key} item={item} />
      ))}
    </section>
  );
}

function KpiSlot({ item }: { item: DashboardKpiItem }) {
  if (item.loading && !item.hasData) {
    return <Skeleton height={116} rounded="xl" />;
  }

  if (item.error) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
            {item.label}
          </span>
          <IconButton
            icon="refresh"
            size="sm"
            aria-label={`Retry ${item.label}`}
            onClick={item.onRetry}
          />
        </div>
        <span className="text-display-sm text-on-surface-variant">—</span>
        {item.description && (
          <p className="text-label-md text-on-surface-variant">{item.description}</p>
        )}
      </div>
    );
  }

  return (
    <StatCard
      label={item.label}
      value={item.value}
      icon={item.icon}
      description={item.description}
      delta={item.delta}
      onClick={item.onClick}
    />
  );
}
