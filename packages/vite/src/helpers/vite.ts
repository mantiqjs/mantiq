import { Application } from '@mantiq/core'
import { Vite } from '../Vite.ts'

/**
 * Get the Vite instance from the application container.
 *
 * @example
 * ```ts
 * import { vite } from '@mantiq/vite'
 * const html = await vite().page({ entry: 'src/main.tsx', title: 'Home' })
 * ```
 */
export function vite(): Vite {
  return Application.getInstance().make(Vite)
}
