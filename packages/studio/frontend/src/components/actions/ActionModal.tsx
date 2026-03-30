import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { FormRenderer } from '@/components/forms/FormRenderer'
import type { ActionSchema, FormSchema } from '@/components/forms/types'

export interface ActionModalProps {
  action: ActionSchema
  open: boolean
  onClose: () => void
  onConfirm: (data?: Record<string, any>) => void
  loading?: boolean
}

export function ActionModal({ action, open, onClose, onConfirm, loading = false }: ActionModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!open) {
      setFormData({})
    }
  }, [open])

  if (!open) return null

  const title = action.confirmation?.title ?? action.confirmationTitle ?? 'Are you sure?'
  const description = action.confirmation?.description ?? action.confirmationDescription
  const confirmLabel = action.confirmation?.confirmLabel ?? action.confirmationButtonLabel ?? 'Confirm'
  const cancelLabel = action.confirmation?.cancelLabel ?? action.cancelButtonLabel ?? 'Cancel'
  const hasForm = action.form || (action.modalForm && action.modalForm.length > 0)
  const isDanger = action.color === 'danger' || action.color === 'destructive'

  // Build form schema from modalForm array if no full form schema is given
  const formSchema: FormSchema | null = action.form
    ? action.form
    : (action.modalForm && action.modalForm.length > 0)
      ? { type: 'form', columns: 1, components: action.modalForm }
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'relative z-50 w-full max-w-md rounded-lg border border-input bg-background p-6 shadow-lg',
        action.modalWidth === 'lg' && 'max-w-lg',
        action.modalWidth === 'xl' && 'max-w-xl',
        action.modalWidth === '2xl' && 'max-w-2xl',
      )}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {hasForm && formSchema && (
            <FormRenderer
              schema={formSchema}
              data={formData}
              onSubmit={(data) => {
                setFormData(data)
                onConfirm(data)
              }}
              submitLabel={confirmLabel}
              loading={loading}
              onCancel={onClose}
            />
          )}

          {!hasForm && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={cn(
                  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                onClick={() => onConfirm()}
                disabled={loading}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  isDanger
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {loading && <Icon name="loader-2" className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
