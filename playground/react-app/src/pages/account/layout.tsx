import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Separator } from '@/components/ui/separator'
import { User, Lock, Palette } from 'lucide-react'

interface AccountLayoutProps {
  children: React.ReactNode
  appName?: string
  currentUser?: any
  navigate: (href: string) => void
  activePath: string
}

const sidebarNav = [
  { title: 'Profile', href: '/account/profile', icon: User },
  { title: 'Security', href: '/account/security', icon: Lock },
  { title: 'Preferences', href: '/account/preferences', icon: Palette },
]

export function AccountLayout({ children, appName, currentUser, navigate, activePath }: AccountLayoutProps) {
  return (
    <AuthenticatedLayout currentUser={currentUser} appName={appName} navigate={navigate} activePath={activePath}>
      <Header fixed navigate={navigate}>
        <h1 className="text-lg font-semibold">Settings</h1>
      </Header>
      <Main>
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="lg:w-48">
            <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto">
              {sidebarNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                    activePath === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.title}
                </a>
              ))}
            </nav>
          </aside>
          <div className="flex-1 lg:max-w-2xl">{children}</div>
        </div>
      </Main>
    </AuthenticatedLayout>
  )
}
