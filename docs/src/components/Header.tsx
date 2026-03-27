import { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { Search } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle.tsx'
import { cn } from '@/lib/utils.ts'

interface HeaderProps {
  onSearchOpen: () => void
  variant?: 'home' | 'docs'
}

export function Header({ onSearchOpen, variant = 'home' }: HeaderProps) {
  const { scrollY } = useScroll()
  const headerBg = useTransform(scrollY, [0, 100], [0, 1])
  const [bgOpacity, setBgOpacity] = useState(0)

  useEffect(() => {
    const unsubscribe = headerBg.on('change', (v) => setBgOpacity(v))
    return unsubscribe
  }, [headerBg])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onSearchOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSearchOpen])

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300',
        bgOpacity > 0.1 ? 'border-border/50' : 'border-transparent'
      )}
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-background) ${Math.round(bgOpacity * 80)}%, transparent)`,
        backdropFilter: bgOpacity > 0.05 ? `blur(${Math.round(bgOpacity * 20)}px) saturate(180%)` : 'none',
        WebkitBackdropFilter: bgOpacity > 0.05 ? `blur(${Math.round(bgOpacity * 20)}px) saturate(180%)` : 'none',
      }}
    >
      <div className={cn(
        'mx-auto flex h-16 items-center justify-between px-6',
        variant === 'docs' ? 'max-w-[90rem]' : 'max-w-6xl'
      )}>
        {/* Logo */}
        <a href="/" className="flex items-center gap-1 group">
          <span className="text-xl font-bold tracking-tight text-foreground">
            <span className="text-primary group-hover:scale-110 inline-block transition-transform duration-200">.</span>
            mantiq
          </span>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>

          {/* Docs link */}
          <a
            href="/docs/introduction"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/mantiqjs/mantiq"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
            </svg>
          </a>

          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  )
}
