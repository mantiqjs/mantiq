import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { navigation, getPage, getAdjacentPages } from '../../../content/navigation.ts'
import { buildSearchIndex, type SearchEntry } from '../../../content/search-index.ts'

const ENTRY = ['src/style.css', 'src/main.tsx']
const HEAD = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
    <script>window.Prism = window.Prism || {}; Prism.manual = true;</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js" defer></script>`

let cachedSearchEntries: SearchEntry[] | null = null

async function getSearchEntries(): Promise<SearchEntry[]> {
  if (cachedSearchEntries) return cachedSearchEntries
  cachedSearchEntries = await buildSearchIndex()
  return cachedSearchEntries
}

export class DocsController {
  async home(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Home',
      entry: ENTRY,
      title: 'MantiqJS — The Productive TypeScript Framework',
      head: HEAD,
      data: { appName: config('app.name') },
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const slug = request.param('slug')
    const page = await getPage(slug)
    const searchEntries = await getSearchEntries()

    if (!page) {
      return vite().render(request, {
        page: 'Doc',
        entry: ENTRY,
        title: '404 — MantiqJS',
        head: HEAD,
        data: {
          navigation,
          slug,
          title: 'Page Not Found',
          content: '<p>This documentation page does not exist yet.</p>',
          prev: null,
          next: null,
          searchEntries,
        },
      })
    }

    const { prev, next } = getAdjacentPages(slug)

    return vite().render(request, {
      page: 'Doc',
      entry: ENTRY,
      title: `${page.title} — MantiqJS`,
      head: HEAD,
      data: {
        navigation,
        slug,
        title: page.title,
        content: page.content,
        prev,
        next,
        searchEntries,
      },
    })
  }
}
