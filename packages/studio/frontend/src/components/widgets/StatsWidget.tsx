import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { StatSchema, WidgetSchema } from '@/components/forms/types'

export interface StatsWidgetProps {
  schema: WidgetSchema & {
    stats?: StatSchema[]
  }
}

function Sparkline({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null

  const height = 32
  const width = 80
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const TREND_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  up: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: 'trending-up',
  },
  down: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    icon: 'trending-down',
  },
  flat: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-600 dark:text-gray-400',
    icon: 'minus',
  },
}

export function StatsWidget({ schema }: StatsWidgetProps) {
  const stats = schema.stats ?? []

  if (stats.length === 0) return null

  return (
    <div className={cn(
      'grid gap-4',
      stats.length === 1 && 'grid-cols-1',
      stats.length === 2 && 'grid-cols-1 sm:grid-cols-2',
      stats.length === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      stats.length >= 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    )}>
      {stats.map((stat, i) => {
        const trend = stat.trend
        const trendStyle = trend ? TREND_COLORS[trend.direction] : null

        return (
          <div
            key={i}
            className="rounded-lg border border-input bg-card p-6"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
              </div>

              {stat.chart && stat.chart.length > 0 && (
                <Sparkline
                  data={stat.chart}
                  color={stat.color ?? 'var(--color-primary)'}
                />
              )}
            </div>

            {(stat.description || trend) && (
              <div className="mt-3 flex items-center gap-2">
                {trend && trendStyle && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    trendStyle.bg,
                    trendStyle.text,
                  )}>
                    <Icon name={trendStyle.icon} className="h-3 w-3" />
                    {trend.value}
                  </span>
                )}

                {stat.description && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {stat.descriptionIcon && (
                      <Icon name={stat.descriptionIcon} className="h-3 w-3" />
                    )}
                    {stat.description}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
