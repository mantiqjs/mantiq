import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Copy, FileText, Pencil } from 'lucide-react'
import { DocsLayout } from '@/components/DocsLayout.tsx'

interface NavPage { slug: string; title: string }
interface NavSection { title: string; pages: NavPage[] }
interface SearchEntry { slug: string; title: string; section: string; headings: { id: string; text: string }[]; plainText: string }

interface DocProps {
  navigation: NavSection[]
  slug: string
  title: string
  content: string
  prev: NavPage | null
  next: NavPage | null
  searchEntries: SearchEntry[]
  appName: string
  navigate: (href: string) => void
}

// Load Prism.js for syntax highlighting (CDN)
function usePrism(deps: any[]) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as any
    if (w.Prism) {
      requestAnimationFrame(() => w.Prism.highlightAll())
      return
    }
    // Load Prism CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css'
    document.head.appendChild(link)

    // Load Prism JS + languages
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js'
    script.onload = () => {
      const langs = ['typescript', 'bash', 'json', 'css', 'markup']
      let loaded = 0
      for (const lang of langs) {
        const s = document.createElement('script')
        s.src = `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-${lang}.min.js`
        s.onload = () => { if (++loaded === langs.length) w.Prism?.highlightAll() }
        document.head.appendChild(s)
      }
    }
    document.head.appendChild(script)
  }, deps)
}

// Add chrome header + copy button to all code blocks
function useCodeCopy(ref: React.RefObject<HTMLDivElement | null>, deps: any[]) {
  useEffect(() => {
    if (!ref.current) return
    const blocks = ref.current.querySelectorAll('pre')
    const cleanups: (() => void)[] = []

    for (const pre of blocks) {
      if (pre.querySelector('.code-chrome')) continue

      // Detect language from class name
      const code = pre.querySelector('code')
      const langClass = code?.className.match(/language-(\w+)/)?.[1] ?? ''
      const langMap: Record<string, string> = {
        typescript: 'TypeScript', ts: 'TypeScript', javascript: 'JavaScript', js: 'JavaScript',
        bash: 'Terminal', sh: 'Terminal', shell: 'Terminal', json: 'JSON', css: 'CSS',
        html: 'HTML', markup: 'HTML', sql: 'SQL', env: '.env',
      }
      const langLabel = langMap[langClass] ?? langClass

      // Language label (top-right, inside the block)
      if (langLabel) {
        const label = document.createElement('span')
        label.className = 'code-lang'
        label.textContent = langLabel
        pre.appendChild(label)
      }

      // Copy button
      const btn = document.createElement('button')
      btn.className = 'copy-btn'
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
      btn.title = 'Copy code'
      btn.onclick = () => {
        const codeText = code?.textContent ?? pre.textContent ?? ''
        navigator.clipboard.writeText(codeText.trim())
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
        setTimeout(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
        }, 2000)
      }
      pre.appendChild(btn)
      cleanups.push(() => { pre.querySelector('.code-lang')?.remove(); btn.remove() })
    }

    return () => cleanups.forEach(fn => fn())
  }, deps)
}

// Convert HTML content to rough markdown for clipboard
function htmlToMarkdown(el: HTMLElement, title: string): string {
  let md = `# ${title}\n\n`
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase()
    const text = child.textContent?.trim() ?? ''
    if (tag === 'h2') md += `## ${text}\n\n`
    else if (tag === 'h3') md += `### ${text}\n\n`
    else if (tag === 'p') md += `${text}\n\n`
    else if (tag === 'pre') md += `\`\`\`\n${text}\n\`\`\`\n\n`
    else if (tag === 'ul') {
      for (const li of child.querySelectorAll('li')) {
        md += `- ${li.textContent?.trim()}\n`
      }
      md += '\n'
    } else if (tag === 'ol') {
      let i = 1
      for (const li of child.querySelectorAll('li')) {
        md += `${i++}. ${li.textContent?.trim()}\n`
      }
      md += '\n'
    } else if (tag === 'blockquote') md += `> ${text}\n\n`
    else if (tag === 'table') {
      const rows = child.querySelectorAll('tr')
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r]!.querySelectorAll('th, td')
        md += '| ' + Array.from(cells).map(c => c.textContent?.trim()).join(' | ') + ' |\n'
        if (r === 0) md += '| ' + Array.from(cells).map(() => '---').join(' | ') + ' |\n'
      }
      md += '\n'
    } else {
      if (text) md += `${text}\n\n`
    }
  }
  return md.trim()
}

export default function Doc({ navigation, slug, title, content, prev, next, searchEntries, navigate }: DocProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [mdCopied, setMdCopied] = useState(false)

  usePrism([slug])
  useCodeCopy(contentRef, [slug, content])

  const section = navigation?.find((s: NavSection) => s.pages.some((p: NavPage) => p.slug === slug))

  const copyAsMarkdown = useCallback(() => {
    if (!contentRef.current) return
    const md = htmlToMarkdown(contentRef.current, title)
    navigator.clipboard.writeText(md)
    setMdCopied(true)
    setTimeout(() => setMdCopied(false), 2000)
  }, [title])

  const editUrl = `https://github.com/mantiqjs/mantiq/edit/master/docs/content/pages/${slug}.ts`

  return (
    <DocsLayout
      navigation={navigation || []}
      currentSlug={slug}
      content={content}
      searchEntries={searchEntries || []}
      navigate={navigate}
    >
      {/* Top actions bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-1"
      >
        {/* Breadcrumb */}
        {section && (
          <span className="text-xs text-muted-foreground">{section.title}</span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={copyAsMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy as Markdown"
          >
            {mdCopied ? <Check className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3" />}
            {mdCopied ? 'Copied' : 'Copy MD'}
          </button>
          <a
            href={editUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit this page on GitHub"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </a>
        </div>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="text-3xl font-bold tracking-tight text-foreground"
      >
        {title}
      </motion.h1>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="mt-3 h-px origin-left bg-gradient-to-r from-primary/40 to-transparent"
      />

      {/* Content */}
      <motion.div
        ref={contentRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="doc-content mt-5"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Prev/Next */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="mt-12 flex items-stretch gap-3 border-t border-border pt-6"
      >
        {prev ? (
          <a
            href={`/docs/${prev.slug}`}
            className="group flex flex-1 flex-col items-start rounded-xl border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
              Previous
            </span>
            <span className="mt-1 text-sm font-medium text-foreground">{prev.title}</span>
          </a>
        ) : <div className="flex-1" />}

        {next ? (
          <a
            href={`/docs/${next.slug}`}
            className="group flex flex-1 flex-col items-end rounded-xl border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Next
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-1 text-sm font-medium text-foreground">{next.title}</span>
          </a>
        ) : <div className="flex-1" />}
      </motion.div>
    </DocsLayout>
  )
}
