import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FormComponentSchema } from '@/components/forms/types'

export interface FileUploadProps {
  schema: FormComponentSchema & {
    accept?: string
    maxSize?: number
    multiple?: boolean
    disk?: string
    directory?: string
    imagePreview?: boolean
  }
  value: File | File[] | string | string[] | null
  onChange: (value: File | File[] | null) => void
  error?: string[]
}

export function FileUpload({ schema, value, onChange, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const hasError = error && error.length > 0
  const isMultiple = schema.multiple ?? false

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)

    // Generate previews for image files
    if (schema.imagePreview) {
      const newPreviews: string[] = []
      for (const file of fileArray) {
        if (file.type.startsWith('image/')) {
          newPreviews.push(URL.createObjectURL(file))
        }
      }
      setPreviews((prev) => (isMultiple ? [...prev, ...newPreviews] : newPreviews))
    }

    if (isMultiple) {
      onChange(fileArray)
    } else {
      onChange(fileArray[0] ?? null)
    }
  }, [schema.imagePreview, isMultiple, onChange])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function clearFiles() {
    onChange(null)
    setPreviews([])
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const hasFiles = isMultiple
    ? Array.isArray(value) && value.length > 0
    : value !== null && value !== undefined

  const fileNames: string[] = []
  if (hasFiles) {
    if (isMultiple && Array.isArray(value)) {
      for (const f of value) {
        fileNames.push(f instanceof File ? f.name : String(f))
      }
    } else if (value) {
      fileNames.push(value instanceof File ? value.name : String(value))
    }
  }

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !schema.disabled && inputRef.current?.click()}
        className={cn(
          'relative flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-input bg-background p-6 text-center transition-colors',
          'hover:border-muted-foreground/50',
          isDragging && 'border-primary bg-primary/5',
          schema.disabled && 'cursor-not-allowed opacity-50',
          hasError && 'border-destructive',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={schema.accept}
          multiple={isMultiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={schema.disabled}
          className="hidden"
        />

        {!hasFiles ? (
          <>
            <Icon name="upload" className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop files here, or click to browse
            </p>
            {schema.accept && (
              <p className="mt-1 text-xs text-muted-foreground">
                Accepted: {schema.accept}
              </p>
            )}
            {schema.maxSize && (
              <p className="text-xs text-muted-foreground">
                Max size: {(schema.maxSize / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </>
        ) : (
          <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            {schema.imagePreview && previews.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {previews.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="h-20 w-20 rounded-md object-cover border border-input"
                  />
                ))}
              </div>
            )}

            <div className="space-y-1">
              {fileNames.map((name, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={clearFiles}
              className="mt-2 inline-flex items-center gap-1 text-sm text-destructive hover:underline"
            >
              <Icon name="trash-2" className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
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
