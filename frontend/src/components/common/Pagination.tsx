import { cn } from '../../utils/cn';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, totalItems, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1,
  );

  return (
    <div className="px-4 py-2 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between text-[11px] text-on-surface-variant">
      <span>
        Showing {startItem} to {endItem} of {totalItems} entries
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 border border-outline-variant rounded hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed"
        >
          &lt;
        </button>
        {pageNumbers.map((n, i) => {
          const prev = pageNumbers[i - 1];
          const showEllipsis = prev !== undefined && n - prev > 1;
          return (
            <span key={n} className="flex items-center gap-1">
              {showEllipsis && <span className="px-1 py-1">...</span>}
              <button
                type="button"
                onClick={() => onPageChange(n)}
                className={cn(
                  'px-2 py-1 border rounded',
                  n === page
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline-variant hover:bg-surface-container-low',
                )}
              >
                {n}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 border border-outline-variant rounded hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed"
        >
          &gt;
        </button>
      </div>
    </div>
  );
}
