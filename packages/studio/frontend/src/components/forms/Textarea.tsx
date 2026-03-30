import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface TextareaProps {
  schema: FormComponentSchema & {
    rows?: number
    autosize?: boolean
  }
  value: string
  onChange: (value: string) => void
  error?: string[]
}

export function Textarea({ schema, value, onChange, error }: TextareaProps) {
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema.placeholder ?? ''}
        disabled={schema.disabled}
        rows={schema.rows ?? 4}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          schema.autosize && 'resize-none',
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
