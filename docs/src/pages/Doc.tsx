import { useEffect } from 'react'

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
  navigate: (href: string) => void
}

export default function Doc({ navigation, slug, title, content, prev, next }: DocProps) {
  // Re-highlight code blocks when content changes
  useEffect(() => {
    requestAnimationFrame(() => {
      if (typeof (window as any).Prism !== 'undefined') {
        ;(window as any).Prism.highlightAll()
      }
    })
  }, [slug])

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-0 bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[90rem] flex items-center justify-between h-14 px-6">
          <a href="/" className="flex items-center gap-2.5 text-text-0 no-underline">
            <span className="font-mono text-lg font-bold tracking-tight">mantiq</span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="/docs/introduction" className="text-accent no-underline font-medium">Docs</a>
            <a href="https://github.com/nicksona/mantiq" target="_blank" rel="noopener" className="text-text-1 hover:text-text-0 transition-colors no-underline">GitHub</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] flex pt-14">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="hidden md:block w-64 shrink-0 border-r border-border-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto px-6 py-4">
          {navigation.map((section) => (
            <div key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              {section.pages.map((page) => (
                <a
                  key={page.slug}
                  href={`/docs/${page.slug}`}
                  className="sidebar-link"
                  data-active={page.slug === slug}
                >
                  {page.title}
                </a>
              ))}
            </div>
          ))}
          <div className="h-8" />
        </aside>

        {/* ── Content ────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-8 lg:px-16 py-10">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-text-0 tracking-tight mb-8">{title}</h1>

            <div
              className="doc-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />

            {/* ── Prev / Next ──────────────────────────────────── */}
            {(prev || next) && (
              <div className="flex gap-4 mt-16 pt-8 border-t border-border-0">
                {prev ? (
                  <a href={`/docs/${prev.slug}`} className="doc-nav-link flex-1">
                    <span className="doc-nav-label">Previous</span>
                    <span className="doc-nav-title">{prev.title}</span>
                  </a>
                ) : <div className="flex-1" />}
                {next ? (
                  <a href={`/docs/${next.slug}`} className="doc-nav-link flex-1 text-right items-end">
                    <span className="doc-nav-label">Next</span>
                    <span className="doc-nav-title">{next.title}</span>
                  </a>
                ) : <div className="flex-1" />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
