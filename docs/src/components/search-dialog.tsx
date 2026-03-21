import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, FileText, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface NavPage {
  slug: string
  title: string
}

interface NavSection {
  title: string
  pages: NavPage[]
}

interface SearchEntry {
  slug: string
  title: string
  section: string
  headings: { id: string; text: string }[]
  plainText: string
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navigation: NavSection[]
  searchEntries?: SearchEntry[]
  navigate: (href: string) => void
}

interface SearchResult {
  slug: string
  title: string
  section: string
  matchType: 'title' | 'heading' | 'content'
  matchText: string
  score: number
}

function searchContent(query: string, entries: SearchEntry[]): SearchResult[] {
  if (!query.trim()) return []
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const entry of entries) {
    const titleLower = entry.title.toLowerCase()
    const titleMatch = tokens.every((t) => titleLower.includes(t))
    if (titleMatch) {
      results.push({
        slug: entry.slug,
        title: entry.title,
        section: entry.section,
        matchType: 'title',
        matchText: entry.title,
        score: 100,
      })
      continue
    }

    let found = false
    for (const heading of entry.headings) {
      const headingLower = heading.text.toLowerCase()
      if (tokens.every((t) => headingLower.includes(t))) {
        results.push({
          slug: entry.slug,
          title: entry.title,
          section: entry.section,
          matchType: 'heading',
          matchText: heading.text,
          score: 50,
        })
        found = true
        break
      }
    }
    if (found) continue

    const textLower = entry.plainText.toLowerCase()
    if (tokens.every((t) => textLower.includes(t))) {
      const firstToken = tokens[0]!
      const idx = textLower.indexOf(firstToken)
      const start = Math.max(0, idx - 40)
      const end = Math.min(entry.plainText.length, idx + firstToken.length + 80)
      const snippet = (start > 0 ? '...' : '') + entry.plainText.slice(start, end).trim() + (end < entry.plainText.length ? '...' : '')
      results.push({
        slug: entry.slug,
        title: entry.title,
        section: entry.section,
        matchType: 'content',
        matchText: snippet,
        score: 10,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 20)
}

// Fallback: search navigation titles only when no search index
function searchNavigation(query: string, navigation: NavSection[]): SearchResult[] {
  if (!query.trim()) return []
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const section of navigation) {
    for (const page of section.pages) {
      const titleLower = page.title.toLowerCase()
      if (tokens.every((t) => titleLower.includes(t))) {
        results.push({
          slug: page.slug,
          title: page.title,
          section: section.title,
          matchType: 'title',
          matchText: page.title,
          score: 100,
        })
      }
    }
  }

  return results
}

export function SearchDialog({ open, onOpenChange, navigation, searchEntries, navigate }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = searchEntries
    ? searchContent(query, searchEntries)
    : searchNavigation(query, navigation)

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(`/docs/${result.slug}`)
    onOpenChange(false)
    setQuery('')
  }, [navigate, onOpenChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }, [results, selectedIndex, handleSelect])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Group results by section
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.section
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search documentation..."
            className="h-12 border-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[0.625rem] font-medium text-muted-foreground ml-2">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type to search across all documentation pages...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([section, sectionResults]) => (
              <div key={section}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {section}
                </div>
                {sectionResults.map((result) => {
                  const thisIndex = flatIndex++
                  return (
                    <button
                      key={`${result.slug}-${result.matchText}`}
                      onClick={() => handleSelect(result)}
                      data-selected={thisIndex === selectedIndex}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent data-[selected=true]:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{result.title}</div>
                        {result.matchType !== 'title' && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {result.matchText}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
