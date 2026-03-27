import type { MantiqRequest } from '@mantiq/core'
import { config } from '@mantiq/core'
import { vite } from '@mantiq/vite'
import { navigation, getPage, getAdjacentPages } from '../../../content/navigation.ts'
import { buildSearchIndex } from '../../../content/search-index.ts'

export class DocsController {
  async home(request: MantiqRequest): Promise<Response> {
    return vite().render(request, {
      page: 'Home',
      entry: ['src/style.css', 'src/main.tsx'],
      title: config('app.name') + ' — The TypeScript Framework for Bun',
      data: { appName: config('app.name') },
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const slug = request.param('slug')
    const page = await getPage(slug)
    if (!page) return new Response('Not Found', { status: 404 })
    const { prev, next } = getAdjacentPages(slug)
    const searchEntries = await buildSearchIndex()
    return vite().render(request, {
      page: 'Doc',
      entry: ['src/style.css', 'src/main.tsx'],
      title: config('app.name') + ' — ' + page.title,
      data: { navigation, slug, ...page, prev, next, searchEntries, appName: config('app.name') },
    })
  }
}
