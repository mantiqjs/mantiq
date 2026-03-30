import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { ColumnSchema } from '@/components/forms/types'

export interface CellRendererProps {
  column: ColumnSchema
  value: unknown
  record: Record<string, any>
}

const BADGE_COLOR_MAP: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground border-secondary',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
  gray: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

function formatMoney(val: unknown): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return String(val ?? '')
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatDateTime(val: unknown): string {
  if (!val) return ''
  const date = new Date(String(val))
  if (isNaN(date.getTime())) return String(val)
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDate(val: unknown): string {
  if (!val) return ''
  const date = new Date(String(val))
  if (isNaN(date.getTime())) return String(val)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

function formatSince(val: unknown): string {
  if (!val) return ''
  const date = new Date(String(val))
  if (isNaN(date.getTime())) return String(val)
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

function limitText(val: string, limit: number): string {
  if (val.length <= limit) return val
  return val.substring(0, limit) + '...'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground"
      title="Copy to clipboard"
    >
      <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
    </button>
  )
}

export function CellRenderer({ column, value }: CellRendererProps) {
  const strVal = value != null ? String(value) : ''

  switch (column.type) {
    case 'text': {
      const copyable = column.copyable as boolean | undefined
      const money = column.money as boolean | undefined
      const dateTime = column.dateTime as boolean | undefined
      const date = column.date as boolean | undefined
      const since = column.since as boolean | undefined
      const limit = column.limit as number | undefined
      const prefix = column.prefix as string | undefined
      const suffix = column.suffix as string | undefined

      let display = strVal
      if (money) display = formatMoney(value)
      else if (dateTime) display = formatDateTime(value)
      else if (date) display = formatDate(value)
      else if (since) display = formatSince(value)
      else if (limit) display = limitText(display, limit)

      if (prefix) display = prefix + display
      if (suffix) display = display + suffix

      return (
        <span className={cn(
          'text-sm',
          column.wrap ? 'whitespace-normal' : 'whitespace-nowrap',
        )}>
          {display}
          {copyable && <CopyButton text={strVal} />}
        </span>
      )
    }

    case 'badge': {
      const colors = (column.colors ?? {}) as Record<string, string>
      const icons = (column.icons ?? {}) as Record<string, string>
      const colorKey = colors[strVal] ?? 'gray'
      const badgeIcon = icons[strVal]
      const colorClasses = BADGE_COLOR_MAP[colorKey] ?? BADGE_COLOR_MAP.gray

      return (
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          colorClasses,
        )}>
          {badgeIcon && <Icon name={badgeIcon} className="h-3 w-3" />}
          {strVal}
        </span>
      )
    }

    case 'boolean': {
      const boolVal = !!value
      const trueIcon = (column.trueIcon as string) ?? 'check'
      const falseIcon = (column.falseIcon as string) ?? 'x'
      const trueColor = (column.trueColor as string) ?? 'success'
      const falseColor = (column.falseColor as string) ?? 'danger'

      const colorMap: Record<string, string> = {
        success: 'text-emerald-600 dark:text-emerald-400',
        danger: 'text-red-600 dark:text-red-400',
        warning: 'text-amber-600 dark:text-amber-400',
        primary: 'text-primary',
        gray: 'text-muted-foreground',
      }

      return (
        <div className={cn(
          'flex items-center',
          boolVal ? (colorMap[trueColor] ?? colorMap.success) : (colorMap[falseColor] ?? colorMap.danger),
        )}>
          <Icon name={boolVal ? trueIcon : falseIcon} className="h-5 w-5" />
        </div>
      )
    }

    case 'image': {
      const circular = column.circular as boolean | undefined
      const square = column.square as boolean | undefined
      const size = (column.size as number) ?? 40
      const defaultUrl = column.defaultUrl as string | undefined
      const src = strVal || defaultUrl || ''

      if (!src) {
        return (
          <div
            className={cn(
              'flex items-center justify-center bg-muted text-muted-foreground',
              circular ? 'rounded-full' : 'rounded-md',
            )}
            style={{ width: size, height: size }}
          >
            <Icon name="image" className="h-4 w-4" />
          </div>
        )
      }

      return (
        <img
          src={src}
          alt=""
          className={cn(
            'object-cover',
            circular ? 'rounded-full' : square ? 'rounded-md' : 'rounded-md',
          )}
          style={{ width: size, height: size }}
        />
      )
    }

    case 'icon': {
      const iconColor = column.color as string | undefined
      const iconSize = column.size as string | undefined

      return (
        <div className={iconColor ? `text-${iconColor}` : 'text-muted-foreground'}>
          <Icon name={strVal || 'circle'} className={iconSize ?? 'h-5 w-5'} />
        </div>
      )
    }

    case 'color': {
      const copyable = column.copyable as boolean | undefined

      return (
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-md border border-input"
            style={{ backgroundColor: strVal || 'transparent' }}
          />
          <span className="text-sm text-muted-foreground">{strVal}</span>
          {copyable && <CopyButton text={strVal} />}
        </div>
      )
    }

    default:
      return <span className="text-sm">{strVal}</span>
  }
}
