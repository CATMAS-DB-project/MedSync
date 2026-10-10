import { cn } from '../../utils/cn';
import { IconButton } from '../ui/IconButton';

export interface PaginationProps {
  page: number;
  pageSize: number;
  /** Alias kept for older callers; prefer `totalItems`. */
  total?: number;
  /** Preferred name — matches the existing page usages. */
  totalItems?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function buildPageList(current: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const totalCount = totalItems ?? total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);
  const pages = buildPageList(page, totalPages);

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 sm:flex-row sm:justify-between',
        className,
      )}
    >
      <p className="text-label-md text-on-surface-variant">
        {start}–{end} of {totalCount}
      </p>

      <div className="flex items-center gap-1">
        <IconButton
          icon="chevron_left"
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {pages.map((p, index) =>
          p === '…' ? (
            <span
              key={`gap-${index}`}
              className="px-1.5 text-label-md text-on-surface-variant"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 text-label-md font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                p === page
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {p}
            </button>
          ),
        )}
        <IconButton
          icon="chevron_right"
          size="sm"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>

      {onPageSizeChange && (
        <label className="hidden items-center gap-1.5 text-label-md text-on-surface-variant sm:inline-flex">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-label-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}