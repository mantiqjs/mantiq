import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface RadioProps {
  schema: FormComponentSchema & {
    options?: Record<string, string>
    inline?: boolean
  }
  value: string
  onChange: (value: string) => void
  error?: string[]
}

export function Radio({ schema, value, onChange, error }: RadioProps) {
  const options = schema.options ?? {}
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className={cn('gap-3', schema.inline ? 'flex flex-wrap' : 'flex flex-col')}>
        {Object.entries(options).map(([key, label]) => (
          <label
            key={key}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              schema.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={value === key}
              disabled={schema.disabled}
              onClick={() => onChange(key)}
              className={cn(
                'h-4 w-4 shrink-0 rounded-full border border-primary ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {value === key && (
                <span className="flex items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              )}
            </button>
            <span className="text-sm">{label}</span>
          </label>
        ))}
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
