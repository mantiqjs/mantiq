import {
  Home,
  Users,
  Settings,
  User,
  Lock,
  Palette,
  BookOpen,
  Github,
  type Component,
} from 'lucide-svelte'

export interface NavItem {
  title: string
  url: string
  icon: Component
  badge?: string
  external?: boolean
  items?: NavItem[]
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const sidebarData: NavGroup[] = [
  {
    title: 'General',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: Home },
      { title: 'Users', url: '/users', icon: Users },
    ],
  },
  {
    title: 'Documentation',
    items: [
      { title: 'Docs', url: 'https://github.com/mantiqjs/mantiq#readme', icon: BookOpen, external: true },
      { title: 'GitHub', url: 'https://github.com/mantiqjs/mantiq', icon: Github, external: true },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        title: 'Settings',
        url: '/account',
        icon: Settings,
        items: [
          { title: 'Profile', url: '/account/profile', icon: User },
          { title: 'Security', url: '/account/security', icon: Lock },
          { title: 'Preferences', url: '/account/preferences', icon: Palette },
        ],
      },
    ],
  },
]
