import App from './App.svelte'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record<string, any>) {
  const { html, head } = (App as any).render({ pages, initialData: data })
  return { html, head }
}
