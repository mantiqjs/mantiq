import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { navigation, getPage, getAdjacentPages } from '../../../content/navigation.ts'
import { buildSearchIndex, type SearchEntry } from '../../../content/search-index.ts'

const ENTRY = ['src/style.css', 'src/main.tsx']
const FONTS_HEAD = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`

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
      head: FONTS_HEAD,
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
        head: FONTS_HEAD,
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
      head: FONTS_HEAD,
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
