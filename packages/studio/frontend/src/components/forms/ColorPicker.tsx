import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface ColorPickerProps {
  schema: FormComponentSchema & {
    format?: 'hex' | 'rgb' | 'hsl'
  }
  value: string
  onChange: (value: string) => void
  error?: string[]
}

export function ColorPicker({ schema, value, onChange, error }: ColorPickerProps) {
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={schema.disabled}
          className={cn(
            'h-10 w-10 shrink-0 cursor-pointer rounded-md border border-input p-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />

        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.placeholder ?? '#000000'}
          disabled={schema.disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'border-destructive focus-visible:ring-destructive',
          )}
        />
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
