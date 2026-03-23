import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

interface TopNavLink {
  title: string
  href: string
  isActive?: boolean
  disabled?: boolean
}

interface TopNavProps extends React.HTMLAttributes<HTMLElement> {
  links: TopNavLink[]
  onLinkClick?: (href: string) => void
}

export function TopNav({
  className,
  links,
  onLinkClick,
  ...props
}: TopNavProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onLinkClick) {
      e.preventDefault()
      onLinkClick(href)
    }
  }

  return (
    <>
      {/* Desktop navigation */}
      <nav
        className={cn(
          'hidden items-center gap-4 md:flex lg:gap-6',
          className,
        )}
        {...props}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={(e) => handleClick(e, link.href)}
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              link.isActive ? 'text-foreground' : 'text-muted-foreground',
              link.disabled && 'pointer-events-none opacity-50',
            )}
          >
            {link.title}
          </a>
        ))}
      </nav>

      {/* Mobile navigation */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle navigation</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {links.map((link) => (
              <DropdownMenuItem
                key={link.href}
                disabled={link.disabled}
                asChild
              >
                <a
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={cn(
                    !link.isActive && 'text-muted-foreground',
                  )}
                >
                  {link.title}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
