import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  navigate: (to: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function Breadcrumbs({ items, navigate }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <span className="text-muted-foreground">
                <Icon name="chevron-right" className="h-3.5 w-3.5" />
              </span>
            )}

            {item.href && !isLast ? (
              <a
                href={item.href}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(item.href!)
                }}
                className={cn(
                  'text-muted-foreground transition-colors hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            ) : (
              <span
                className={cn(
                  isLast ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
