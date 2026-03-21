import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface DocsHeaderProps {
  sectionTitle?: string
  pageTitle?: string
  onSearchOpen: () => void
}

export function DocsHeader({ sectionTitle, pageTitle, onSearchOpen }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 backdrop-blur-xl px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {sectionTitle && (
          <>
            <span>{sectionTitle}</span>
            {pageTitle && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-foreground font-medium">{pageTitle}</span>
              </>
            )}
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        {/* Search button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSearchOpen}
          className="hidden sm:flex items-center gap-2 text-muted-foreground h-8 w-56 justify-start font-normal"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search docs...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[0.625rem] font-medium text-muted-foreground">
            <span className="text-xs">&#x2318;</span>K
          </kbd>
        </Button>

        {/* Mobile search */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchOpen}
          className="sm:hidden h-8 w-8"
        >
          <Search className="h-4 w-4" />
        </Button>

        <ThemeToggle />
      </div>
    </header>
  )
}
