import { useState, useEffect, useCallback } from 'react'
import {
  Home,
  Users,
  Settings,
  User,
  Lock,
  Palette,
  BookOpen,
  Github,
  FileText,
  ArrowRight,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navigate: (href: string) => void
}

const pages = [
  { title: 'Dashboard', url: '/dashboard', icon: Home, group: 'Pages' },
  { title: 'Users', url: '/users', icon: Users, group: 'Pages' },
  { title: 'Profile', url: '/account/profile', icon: User, group: 'Settings' },
  { title: 'Security', url: '/account/security', icon: Lock, group: 'Settings' },
  { title: 'Preferences', url: '/account/preferences', icon: Palette, group: 'Settings' },
  { title: 'Documentation', url: 'https://github.com/mantiqjs/mantiq#readme', icon: BookOpen, group: 'Links', external: true },
  { title: 'GitHub', url: 'https://github.com/mantiqjs/mantiq', icon: Github, group: 'Links', external: true },
]

export function SearchDialog({ open, onOpenChange, navigate }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const filtered = query.trim()
    ? pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
    : pages

  const groups = [...new Set(filtered.map(p => p.group))]

  useEffect(() => {
    setSelected(0)
  }, [query])

  const handleSelect = useCallback((item: typeof pages[number]) => {
    onOpenChange(false)
    setQuery('')
    if (item.external) {
      window.open(item.url, '_blank')
    } else {
      navigate(item.url)
    }
  }, [onOpenChange, navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      handleSelect(filtered[selected])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 gap-0 sm:max-w-[480px]">
        <div className="flex items-center border-b px-3">
          <FileText className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          )}
          {groups.map(group => {
            const items = filtered.filter(p => p.group === group)
            if (!items.length) return null
            let globalIndex = filtered.indexOf(items[0]!)
            return (
              <div key={group}>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
                {items.map((item, i) => {
                  const idx = globalIndex + i
                  return (
                    <button
                      key={item.url}
                      onClick={() => handleSelect(item)}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                        idx === selected ? 'bg-accent text-accent-foreground' : 'text-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{item.title}</span>
                      {idx === selected && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
