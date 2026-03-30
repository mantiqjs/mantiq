import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'

export interface DeleteConfirmationProps {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export function DeleteConfirmation({
  open,
  title = 'Delete record',
  description = 'Are you sure you want to delete this record? This action cannot be undone.',
  onClose,
  onConfirm,
  loading = false,
}: DeleteConfirmationProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-md rounded-lg border border-input bg-background p-6 shadow-lg">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Icon name="triangle-alert" className="h-5 w-5 text-destructive" />
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>

            <div className="mt-6 flex items-center justify-end gap-3">
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
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {loading && <Icon name="loader-2" className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
