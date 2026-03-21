import { useRef, useEffect, useCallback } from 'react'
import { FileText, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { DocsLayout } from '@/components/layout/docs-layout'
import { useCodeCopy } from '@/hooks/use-code-copy'
import { htmlToMarkdown } from '@/lib/html-to-markdown'

interface NavPage {
  slug: string
  title: string
}

interface NavSection {
  title: string
  pages: NavPage[]
}

interface DocProps {
  navigation: NavSection[]
  slug: string
  title: string
  content: string
  prev: NavPage | null
  next: NavPage | null
  searchEntries?: any[]
  navigate: (href: string) => void
  loading?: boolean
}

export default function Doc({ navigation, slug, title, content, prev, next, searchEntries, navigate, loading }: DocProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  useCodeCopy(contentRef, [slug])

  // Syntax highlighting
  useEffect(() => {
    requestAnimationFrame(() => {
      if (typeof (window as any).Prism !== 'undefined') {
        ;(window as any).Prism.highlightAll()
      }
    })
  }, [slug])

  // Keyboard navigation: j/k for next/prev
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'j' && next) navigate(`/docs/${next.slug}`)
      if (e.key === 'k' && prev) navigate(`/docs/${prev.slug}`)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [prev, next, navigate])

  const copyAsMarkdown = useCallback(() => {
    if (!contentRef.current) return
    const md = htmlToMarkdown(contentRef.current, title)
    navigator.clipboard.writeText(md)
  }, [title])

  if (loading) {
    return (
      <DocsLayout navigation={navigation} slug={slug} title={title} navigate={navigate} searchEntries={searchEntries}>
        <div className="px-8 lg:px-16 py-10 max-w-3xl">
          <Skeleton className="h-9 w-64 mb-8" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-5/6 mb-3" />
          <Skeleton className="h-4 w-4/6 mb-6" />
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-3/4 mb-3" />
        </div>
      </DocsLayout>
    )
  }

  return (
    <DocsLayout navigation={navigation} slug={slug} title={title} navigate={navigate} searchEntries={searchEntries}>
      <div className="px-8 lg:px-16 py-10">
        <div className="max-w-3xl">
          {/* Page header */}
          <div className="flex items-start justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            <div className="flex items-center gap-1 shrink-0 ml-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAsMarkdown}>
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy as Markdown</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://github.com/mantiqjs/mantiq/edit/master/docs/content/pages/${slug}.ts`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>Edit on GitHub</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            className="doc-content animate-fade-up"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Prev / Next */}
          {(prev || next) && (
            <div className="flex gap-4 mt-16 pt-8 border-t">
              {prev ? (
                <a href={`/docs/${prev.slug}`} className="doc-nav-link flex-1">
                  <span className="doc-nav-label flex items-center gap-1">
                    <ChevronLeft className="h-3 w-3" /> Previous
                  </span>
                  <span className="doc-nav-title">{prev.title}</span>
                </a>
              ) : <div className="flex-1" />}
              {next ? (
                <a href={`/docs/${next.slug}`} className="doc-nav-link flex-1 text-right items-end">
                  <span className="doc-nav-label flex items-center justify-end gap-1">
                    Next <ChevronRight className="h-3 w-3" />
                  </span>
                  <span className="doc-nav-title">{next.title}</span>
                </a>
              ) : <div className="flex-1" />}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-6 border-t text-xs text-muted-foreground flex items-center justify-between">
            <span>Built with MantiqJS</span>
            <span>MIT License</span>
          </footer>
        </div>
      </div>
    </DocsLayout>
  )
}
