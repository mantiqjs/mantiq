import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, FileText, Hash, X } from 'lucide-react'

interface SearchEntry {
  slug: string
  title: string
  section: string
  headings: { id: string; text: string }[]
  plainText: string
}

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
  entries: SearchEntry[]
  navigate: (href: string) => void
}

interface SearchResult {
  slug: string
  title: string
  section: string
  type: 'page' | 'heading'
  headingId?: string
  headingText?: string
  snippet?: string
}

export function SearchDialog({ isOpen, onClose, entries, navigate }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const found: SearchResult[] = []

    for (const entry of entries) {
      // Match page title
      if (entry.title.toLowerCase().includes(q)) {
        found.push({ slug: entry.slug, title: entry.title, section: entry.section, type: 'page' })
      }

      // Match headings
      for (const h of entry.headings) {
        if (h.text.toLowerCase().includes(q)) {
          found.push({
            slug: entry.slug,
            title: entry.title,
            section: entry.section,
            type: 'heading',
            headingId: h.id,
            headingText: h.text,
          })
        }
      }

      // Match content (only if title/heading didn't match)
      if (!found.some((r) => r.slug === entry.slug) && entry.plainText.toLowerCase().includes(q)) {
        const idx = entry.plainText.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 40)
        const end = Math.min(entry.plainText.length, idx + q.length + 60)
        const snippet = (start > 0 ? '...' : '') + entry.plainText.slice(start, end) + (end < entry.plainText.length ? '...' : '')
        found.push({ slug: entry.slug, title: entry.title, section: entry.section, type: 'page', snippet })
      }
    }

    return found.slice(0, 20)
  }, [query, entries])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const hash = result.type === 'heading' && result.headingId ? `#${result.headingId}` : ''
      navigate(`/docs/${result.slug}${hash}`)
      onClose()
    },
    [navigate, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[activeIndex]) {
        handleSelect(results[activeIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [results, activeIndex, handleSelect, onClose]
  )

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-[15vh] z-[101] mx-auto w-full max-w-xl px-4"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
              {/* Input */}
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search documentation..."
                  className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
                {query && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                )}

                {results.map((result, i) => (
                  <button
                    key={`${result.slug}-${result.headingId ?? result.type}-${i}`}
                    data-index={i}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      i === activeIndex ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {result.type === 'heading' ? (
                      <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {result.type === 'heading' ? result.headingText : result.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {result.section}
                        {result.type === 'heading' && ` / ${result.title}`}
                      </div>
                      {result.snippet && (
                        <div className="mt-1 truncate text-xs text-muted-foreground/70">{result.snippet}</div>
                      )}
                    </div>
                  </button>
                ))}

                {!query && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Type to search the documentation
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">&uarr;</kbd>
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">&darr;</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px]">&#9166;</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px]">esc</kbd>
                  close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
