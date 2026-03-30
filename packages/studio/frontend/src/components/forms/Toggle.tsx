import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface ToggleProps {
  schema: FormComponentSchema & {
    onLabel?: string
    offLabel?: string
    onColor?: string
    offColor?: string
  }
  value: boolean
  onChange: (value: boolean) => void
  error?: string[]
}

export function Toggle({ schema, value, onChange, error }: ToggleProps) {
  const checked = !!value
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={schema.disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary' : 'bg-input',
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>

        {schema.label && (
          <label className="text-sm font-medium leading-none">
            {schema.label}
            {schema.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}

        {(schema.onLabel || schema.offLabel) && (
          <span className="text-sm text-muted-foreground">
            {checked ? schema.onLabel : schema.offLabel}
          </span>
        )}
      </div>

      {schema.helperText && !hasError && (
        <p className="text-sm text-muted-foreground">{schema.helperText}</p>
      )}

      {hasError && (
        <div className="space-y-1">
          {error.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
