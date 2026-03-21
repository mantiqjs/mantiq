import { navigation, getPage } from './navigation.ts'

export interface SearchEntry {
  slug: string
  title: string
  section: string
  headings: { id: string; text: string }[]
  plainText: string
}

function extractHeadings(html: string): { id: string; text: string }[] {
  const headings: { id: string; text: string }[] = []
  const regex = /<h[23][^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const text = (match[2] ?? '').replace(/<[^>]+>/g, '').trim()
    const id = match[1] || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    headings.push({ id, text })
  }
  return headings
}

function stripHtml(html: string): string {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, '') // remove code blocks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = []

  for (const section of navigation) {
    for (const navPage of section.pages) {
      const page = await getPage(navPage.slug)
      if (!page) continue

      entries.push({
        slug: navPage.slug,
        title: page.title,
        section: section.title,
        headings: extractHeadings(page.content),
        plainText: stripHtml(page.content).slice(0, 2000), // limit size
      })
    }
  }

  return entries
}
