import { cn } from '@/lib/utils'
import type { FormComponentSchema } from '@/components/forms/types'

export interface TextInputProps {
  schema: FormComponentSchema & {
    inputType?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
    maxLength?: number
    minLength?: number
    prefix?: string
    suffix?: string
    mask?: string
  }
  value: string | number
  onChange: (value: string | number) => void
  error?: string[]
}

export function TextInput({ schema, value, onChange, error }: TextInputProps) {
  const inputType = schema.inputType ?? 'text'
  const hasPrefix = !!schema.prefix
  const hasSuffix = !!schema.suffix
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {hasPrefix && (
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {schema.prefix}
          </span>
        )}

        <input
          type={inputType}
          value={value ?? ''}
          onChange={(e) => {
            const val = inputType === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
            onChange(val)
          }}
          placeholder={schema.placeholder ?? ''}
          disabled={schema.disabled}
          maxLength={schema.maxLength}
          minLength={schema.minLength}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasPrefix && 'rounded-l-none',
            hasSuffix && 'rounded-r-none',
            hasError && 'border-destructive focus-visible:ring-destructive',
          )}
        />

        {hasSuffix && (
          <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {schema.suffix}
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
