import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface DatePickerProps {
  schema: FormComponentSchema & {
    format?: string
    minDate?: string
    maxDate?: string
    withTime?: boolean
  }
  value: string
  onChange: (value: string) => void
  error?: string[]
}

export function DatePicker({ schema, value, onChange, error }: DatePickerProps) {
  const hasError = error && error.length > 0
  const inputType = schema.withTime ? 'datetime-local' : 'date'

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <input
        type={inputType}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        min={schema.minDate}
        max={schema.maxDate}
        disabled={schema.disabled}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
        )}
      />

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
