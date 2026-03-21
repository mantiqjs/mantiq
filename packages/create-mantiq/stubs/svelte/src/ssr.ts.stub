import { render } from 'svelte/server'
import App from './App.svelte'
import { pages } from './pages.ts'

export function renderApp(_url: string, data?: Record<string, any>) {
  const { html, head } = render(App, { props: { pages, initialData: data } })
  return { html, head }
}

export { renderApp as render }
