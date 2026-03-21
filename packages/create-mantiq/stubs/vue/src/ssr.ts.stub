import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue'
import { pages } from './pages.ts'

export async function render(_url: string, data?: Record<string, any>) {
  const app = createSSRApp(App, { pages, initialData: data })
  return { html: await renderToString(app) }
}
