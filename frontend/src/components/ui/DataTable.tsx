import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import { Button } from './Button';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  hideOnMobile?: boolean;
  primary?: boolean;
  secondary?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyState?: ReactNode;
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  rowActions?: (row: T) => ReactNode;
  pagination?: ReactNode;
  skeletonRows?: number;
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  emptyState,
  onSortChange,
  sortKey,
  sortDirection,
  rowActions,
  pagination,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const showInitialSkeleton = loading && rows.length === 0;

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSortChange) return;
    const nextDirection =
      sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(column.key, nextDirection);
  };

  const sortIconFor = (column: DataTableColumn<T>) => {
    if (!column.sortable) return null;
    if (sortKey !== column.key) {
      return <Icon name="unfold_more" size={14} className="text-on-surface-variant/60" />;
    }
    return (
      <Icon
        name={sortDirection === 'asc' ? 'expand_less' : 'expand_more'}
        size={14}
        className="text-primary"
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl bg-surface-container-lowest shadow-card md:block">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <Icon name="error" size={20} />
            </span>
            <p className="text-body-sm text-on-surface-variant">{error}</p>
            {onRetry && (
              <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : showInitialSkeleton ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant',
                      ALIGN[col.align ?? 'left'],
                      col.hideOnMobile && 'hidden',
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
                {rowActions && <th className="w-12 px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-outline-variant/60 last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton height={14} width="70%" />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3">
                      <Skeleton height={14} width={14} rounded="full" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14">{emptyState}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                {columns.map((col) => {
                  const clickable = col.sortable && !!onSortChange;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        'px-4 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant',
                        ALIGN[col.align ?? 'left'],
                        col.headerClassName,
                      )}
                    >
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md transition-colors hover:text-on-surface',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                            col.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          <span>{col.header}</span>
                          {sortIconFor(col)}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
                {rowActions && <th className="w-12 px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group/row border-b border-outline-variant/60 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-primary-container/30',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 align-middle text-table-data text-on-surface',
                        ALIGN[col.align ?? 'left'],
                        col.cellClassName,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 align-middle text-right">
                      <div
                        className="flex justify-end opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 transition-opacity"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-6 text-center shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <Icon name="error" size={20} />
            </span>
            <p className="text-body-sm text-on-surface-variant">{error}</p>
            {onRetry && (
              <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : showInitialSkeleton ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <Skeleton height={14} width="60%" />
              <div className="mt-3 space-y-2">
                <Skeleton height={12} width="40%" />
                <Skeleton height={12} width="50%" />
              </div>
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-lowest px-4 py-12 shadow-card">
            {emptyState}
          </div>
        ) : (
          rows.map((row) => {
            const primary = columns.find((c) => c.primary);
            const secondary = columns.find((c) => c.secondary);
            const rest = columns.filter((c) => c !== primary && c !== secondary && !c.hideOnMobile);

            return (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'rounded-2xl bg-surface-container-lowest p-4 shadow-card',
                  onRowClick && 'cursor-pointer active:bg-primary-container/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {primary && (
                      <div className="text-body-md font-semibold text-on-surface">
                        {primary.cell(row)}
                      </div>
                    )}
                    {secondary && (
                      <div className="mt-0.5 text-body-sm text-on-surface-variant">
                        {secondary.cell(row)}
                      </div>
                    )}
                  </div>
                  {rowActions && (
                    <div onClick={(event) => event.stopPropagation()}>{rowActions(row)}</div>
                  )}
                </div>

                {rest.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-outline-variant pt-3">
                    {rest.map((col) => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                          {col.header}
                        </dt>
                        <dd className="mt-0.5 truncate text-body-sm text-on-surface">
                          {col.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })
        )}
      </div>

      {pagination && <div className="flex justify-center sm:justify-end">{pagination}</div>}
    </div>
  );
}