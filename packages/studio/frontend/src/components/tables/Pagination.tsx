import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { PaginationMeta } from '@/components/forms/types'

export interface PaginationProps {
  meta: PaginationMeta
  page: number
  perPage: number
  paginationPageOptions: number[]
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}

export function Pagination({
  meta,
  page,
  perPage,
  paginationPageOptions,
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  const { total, lastPage, from, to } = meta

  // Build page numbers to show
  function getPageNumbers(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = []
    const delta = 2

    for (let i = 1; i <= lastPage; i++) {
      if (
        i === 1 ||
        i === lastPage ||
        (i >= page - delta && i <= page + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis')
      }
    }

    return pages
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 px-2 py-4 sm:flex-row">
      {/* Info text */}
      <div className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>Showing {from} to {to} of {total} results</>
        ) : (
          <>No results</>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Per-page selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className={cn(
              'h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {paginationPageOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors',
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Icon name="chevron-left" className="h-4 w-4" />
          </button>

          {getPageNumbers().map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">...</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors',
                  item === page
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= lastPage}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors',
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
