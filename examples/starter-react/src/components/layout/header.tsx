import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { SearchDialog } from '@/components/layout/search-dialog'
import { Search } from 'lucide-react'

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean
  navigate?: (href: string) => void
}

export function Header({ className, fixed, children, navigate, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleNavigate = useCallback((href: string) => {
    if (navigate) {
      navigate(href)
    } else {
      window.location.href = href
    }
  }, [navigate])

  return (
    <>
      <header
        className={cn(
          'flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
          fixed && 'sticky top-0 z-10 bg-background',
          offset > 10 && fixed ? 'border-b' : '',
          className,
        )}
        {...props}
      >
        <div className="flex w-full items-center gap-2 px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 hidden h-4 md:block" />
          {children}
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
            <Button
              variant="outline"
              className="relative hidden h-8 justify-start rounded-md text-sm text-muted-foreground sm:flex sm:w-40 lg:w-64"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Search...
              <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:flex">
                <span className="text-xs">&#x2318;</span>K
              </kbd>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} navigate={handleNavigate} />
    </>
  )
}
