// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { StudioPanel } from '../../../src/StudioPanel.ts'
import { PanelManager } from '../../../src/panel/PanelManager.ts'
import { Resource } from '../../../src/resources/Resource.ts'
import { Form } from '../../../src/forms/Form.ts'
import { TextInput } from '../../../src/forms/components/TextInput.ts'
import { Table } from '../../../src/tables/Table.ts'
import { TextColumn } from '../../../src/tables/columns/TextColumn.ts'

// Mock resource
class UserResource extends Resource {
  static override slug = 'users'
  override form() { return Form.make([TextInput.make('name')]) }
  override table() { return Table.make([TextColumn.make('name')]) }
}

// Concrete panel subclasses for testing
class AdminPanel extends StudioPanel {
  override path = '/admin'
  override brandName = 'Admin Dashboard'

  override resources() {
    return [UserResource as unknown as typeof Resource]
  }
}

class CustomerPanel extends StudioPanel {
  override path = '/portal'
  override brandName = 'Customer Portal'

  override resources() {
    return []
  }
}

class PartnerDashboardPanel extends StudioPanel {
  override path = '/partners'
  override brandName = 'Partners'

  override resources() {
    return []
  }
}

describe('StudioPanel', () => {
  describe('id derivation', () => {
    it('derives id from AdminPanel to admin', () => {
      const panel = new AdminPanel()
      expect(panel.id).toBe('admin')
    })

    it('derives id from CustomerPanel to customer', () => {
      const panel = new CustomerPanel()
      expect(panel.id).toBe('customer')
    })

    it('derives id from PartnerDashboardPanel to partner-dashboard', () => {
      const panel = new PartnerDashboardPanel()
      expect(panel.id).toBe('partner-dashboard')
    })
  })

  describe('defaults', () => {
    it('defaults path to /admin', () => {
      // StudioPanel prototype default
      class TestPanel extends StudioPanel {
        override resources() { return [] }
      }
      const panel = new TestPanel()
      expect(panel.path).toBe('/admin')
    })

    it('defaults brandName to Studio', () => {
      class TestPanel extends StudioPanel {
        override resources() { return [] }
      }
      const panel = new TestPanel()
      expect(panel.brandName).toBe('Studio')
    })

    it('defaults brandLogo to undefined', () => {
      const panel = new AdminPanel()
      expect(panel.brandLogo).toBeUndefined()
    })

    it('defaults favicon to undefined', () => {
      const panel = new AdminPanel()
      expect(panel.favicon).toBeUndefined()
    })
  })

  describe('overrides', () => {
    it('uses overridden path', () => {
      const panel = new AdminPanel()
      expect(panel.path).toBe('/admin')
    })

    it('uses overridden brandName', () => {
      const panel = new AdminPanel()
      expect(panel.brandName).toBe('Admin Dashboard')
    })
  })

  describe('access control defaults', () => {
    it('canAccess defaults to true', () => {
      const panel = new AdminPanel()
      expect(panel.canAccess({})).toBe(true)
    })

    it('guard defaults to web', () => {
      const panel = new AdminPanel()
      expect(panel.guard()).toBe('web')
    })

    it('loginUrl defaults to /login', () => {
      const panel = new AdminPanel()
      expect(panel.loginUrl()).toBe('/login')
    })
  })

  describe('access control overrides', () => {
    class RestrictedPanel extends StudioPanel {
      override path = '/restricted'

      override resources() { return [] }

      override canAccess(user: any) {
        return user.role === 'admin'
      }

      override guard() {
        return 'admin'
      }

      override loginUrl() {
        return '/admin/login'
      }
    }

    it('uses overridden canAccess', () => {
      const panel = new RestrictedPanel()
      expect(panel.canAccess({ role: 'admin' })).toBe(true)
      expect(panel.canAccess({ role: 'user' })).toBe(false)
    })

    it('uses overridden guard', () => {
      const panel = new RestrictedPanel()
      expect(panel.guard()).toBe('admin')
    })

    it('uses overridden loginUrl', () => {
      const panel = new RestrictedPanel()
      expect(panel.loginUrl()).toBe('/admin/login')
    })
  })

  describe('theme defaults', () => {
    it('colors returns empty object', () => {
      const panel = new AdminPanel()
      expect(panel.colors()).toEqual({})
    })

    it('darkMode defaults to true', () => {
      const panel = new AdminPanel()
      expect(panel.darkMode()).toBe(true)
    })

    it('sidebarCollapsible defaults to true', () => {
      const panel = new AdminPanel()
      expect(panel.sidebarCollapsible()).toBe(true)
    })

    it('topNavigation defaults to false', () => {
      const panel = new AdminPanel()
      expect(panel.topNavigation()).toBe(false)
    })

    it('globalSearch defaults to true', () => {
      const panel = new AdminPanel()
      expect(panel.globalSearch()).toBe(true)
    })

    it('maxContentWidth defaults to 7xl', () => {
      const panel = new AdminPanel()
      expect(panel.maxContentWidth()).toBe('7xl')
    })
  })

  describe('optional methods', () => {
    it('widgets returns empty array', () => {
      const panel = new AdminPanel()
      expect(panel.widgets()).toEqual([])
    })

    it('pages returns empty array', () => {
      const panel = new AdminPanel()
      expect(panel.pages()).toEqual([])
    })

    it('middleware returns empty array', () => {
      const panel = new AdminPanel()
      expect(panel.middleware()).toEqual([])
    })

    it('navigationGroups returns empty array', () => {
      const panel = new AdminPanel()
      expect(panel.navigationGroups()).toEqual([])
    })
  })

  describe('boot', () => {
    it('boot is a no-op by default', () => {
      const panel = new AdminPanel()
      // Should not throw
      panel.boot({} as any)
    })
  })
})

describe('PanelManager', () => {
  it('registers a panel', () => {
    const manager = new PanelManager()
    const panel = new AdminPanel()
    manager.register(panel)
    expect(manager.has('admin')).toBe(true)
  })

  it('resolves panel by path', () => {
    const manager = new PanelManager()
    const panel = new AdminPanel()
    manager.register(panel)

    const resolved = manager.resolve('/admin')
    expect(resolved).toBe(panel)
  })

  it('returns undefined for unknown path', () => {
    const manager = new PanelManager()
    expect(manager.resolve('/unknown')).toBeUndefined()
  })

  it('gets panel by id', () => {
    const manager = new PanelManager()
    const panel = new AdminPanel()
    manager.register(panel)

    expect(manager.get('admin')).toBe(panel)
  })

  it('returns undefined for unknown id', () => {
    const manager = new PanelManager()
    expect(manager.get('unknown')).toBeUndefined()
  })

  it('returns all registered panels', () => {
    const manager = new PanelManager()
    manager.register(new AdminPanel())
    manager.register(new CustomerPanel())

    const all = manager.all()
    expect(all).toHaveLength(2)
  })

  it('returns default panel as the first registered', () => {
    const manager = new PanelManager()
    const admin = new AdminPanel()
    const customer = new CustomerPanel()
    manager.register(admin)
    manager.register(customer)

    expect(manager.default()).toBe(admin)
  })

  it('returns undefined default when no panels registered', () => {
    const manager = new PanelManager()
    expect(manager.default()).toBeUndefined()
  })

  it('counts registered panels', () => {
    const manager = new PanelManager()
    expect(manager.count()).toBe(0)

    manager.register(new AdminPanel())
    expect(manager.count()).toBe(1)

    manager.register(new CustomerPanel())
    expect(manager.count()).toBe(2)
  })

  it('has returns false for unregistered panel', () => {
    const manager = new PanelManager()
    expect(manager.has('admin')).toBe(false)
  })

  it('registers multiple panels with different paths', () => {
    const manager = new PanelManager()
    manager.register(new AdminPanel())
    manager.register(new CustomerPanel())

    expect(manager.resolve('/admin')!.brandName).toBe('Admin Dashboard')
    expect(manager.resolve('/portal')!.brandName).toBe('Customer Portal')
  })

  it('does not resolve panels by id when using resolve', () => {
    const manager = new PanelManager()
    manager.register(new AdminPanel())

    // resolve() matches by path, not by id
    expect(manager.resolve('admin')).toBeUndefined()
  })

  it('all returns empty array when no panels', () => {
    const manager = new PanelManager()
    expect(manager.all()).toEqual([])
  })
})
