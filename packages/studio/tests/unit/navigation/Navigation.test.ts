// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { NavigationItem } from '../../../src/navigation/NavigationItem.ts'
import { NavigationGroup } from '../../../src/navigation/NavigationGroup.ts'
import { NavigationBuilder } from '../../../src/navigation/NavigationBuilder.ts'
import { Resource } from '../../../src/resources/Resource.ts'
import { Form } from '../../../src/forms/Form.ts'
import { TextInput } from '../../../src/forms/components/TextInput.ts'
import { Table } from '../../../src/tables/Table.ts'
import { TextColumn } from '../../../src/tables/columns/TextColumn.ts'

// Mock resources for testing navigation builder
class UserResource extends Resource {
  static override navigationIcon = 'users'
  static override navigationGroup = 'Admin'
  static override navigationSort = 1
  static override navigationLabel = 'Users'
  static override slug = 'users'
  override form() { return Form.make([TextInput.make('name')]) }
  override table() { return Table.make([TextColumn.make('name')]) }
}

class PostResource extends Resource {
  static override navigationIcon = 'file-text'
  static override navigationGroup = 'Content'
  static override navigationSort = 0
  static override navigationLabel = 'Posts'
  static override slug = 'posts'
  override form() { return Form.make([TextInput.make('title')]) }
  override table() { return Table.make([TextColumn.make('title')]) }
}

class SettingResource extends Resource {
  static override navigationIcon = 'settings'
  static override navigationGroup = ''
  static override navigationSort = 10
  static override navigationLabel = 'Settings'
  static override slug = 'settings'
  override form() { return Form.make([TextInput.make('key')]) }
  override table() { return Table.make([TextColumn.make('key')]) }
}

class PageResource extends Resource {
  static override navigationIcon = 'document'
  static override navigationGroup = 'Content'
  static override navigationSort = 1
  static override navigationLabel = 'Pages'
  static override slug = 'pages'
  override form() { return Form.make([TextInput.make('title')]) }
  override table() { return Table.make([TextColumn.make('title')]) }
}

describe('NavigationItem', () => {
  it('creates via static make', () => {
    const item = NavigationItem.make('Users')
    expect(item.getLabel()).toBe('Users')
  })

  it('sets icon', () => {
    const item = NavigationItem.make('Users').icon('users')
    expect(item.getIcon()).toBe('users')
  })

  it('sets url', () => {
    const item = NavigationItem.make('Users').url('/admin/users')
    expect(item.getUrl()).toBe('/admin/users')
  })

  it('sets badge', () => {
    const item = NavigationItem.make('Notifications').badge(5)
    expect(item.getBadge()).toBe(5)
  })

  it('sets badge with string', () => {
    const item = NavigationItem.make('Tasks').badge('New')
    expect(item.getBadge()).toBe('New')
  })

  it('sets badgeColor', () => {
    const item = NavigationItem.make('Alerts').badge(3).badgeColor('red')
    expect(item.getBadgeColor()).toBe('red')
  })

  it('sets active state', () => {
    const item = NavigationItem.make('Users').active()
    expect(item.getIsActive()).toBe(true)
  })

  it('defaults active to false', () => {
    const item = NavigationItem.make('Users')
    expect(item.getIsActive()).toBe(false)
  })

  it('sets children', () => {
    const item = NavigationItem.make('Settings')
      .children([
        NavigationItem.make('General'),
        NavigationItem.make('Security'),
      ])
    expect(item.getChildren()).toHaveLength(2)
  })

  it('defaults children to empty array', () => {
    const item = NavigationItem.make('Users')
    expect(item.getChildren()).toEqual([])
  })

  it('serializes to schema', () => {
    const schema = NavigationItem.make('Users')
      .icon('users')
      .url('/admin/users')
      .badge(42)
      .badgeColor('blue')
      .active()
      .toSchema()

    expect(schema.label).toBe('Users')
    expect(schema.icon).toBe('users')
    expect(schema.url).toBe('/admin/users')
    expect(schema.badge).toBe(42)
    expect(schema.badgeColor).toBe('blue')
    expect(schema.isActive).toBe(true)
  })

  it('serializes children recursively', () => {
    const schema = NavigationItem.make('Settings')
      .children([
        NavigationItem.make('General').url('/general'),
        NavigationItem.make('Security').url('/security'),
      ])
      .toSchema()

    const children = schema.children as Record<string, unknown>[]
    expect(children).toHaveLength(2)
    expect(children[0].label).toBe('General')
    expect(children[1].url).toBe('/security')
  })

  it('returns correct fluent chain type', () => {
    const item = NavigationItem.make('Test')
      .icon('star')
      .url('/test')
      .badge(1)
      .badgeColor('yellow')
      .active()
    // If fluent chaining is broken, this will fail to compile
    expect(item).toBeInstanceOf(NavigationItem)
  })
})

describe('NavigationGroup', () => {
  it('creates via static make', () => {
    const group = NavigationGroup.make('Admin')
    expect(group.getLabel()).toBe('Admin')
  })

  it('sets icon', () => {
    const group = NavigationGroup.make('Admin').icon('shield')
    expect(group.getIcon()).toBe('shield')
  })

  it('sets items', () => {
    const group = NavigationGroup.make('Admin')
      .items([
        NavigationItem.make('Users'),
        NavigationItem.make('Roles'),
      ])
    expect(group.getItems()).toHaveLength(2)
  })

  it('enables collapsible', () => {
    const group = NavigationGroup.make('Admin').collapsible()
    expect(group.getCollapsible()).toBe(true)
  })

  it('defaults collapsible to false', () => {
    const group = NavigationGroup.make('Admin')
    expect(group.getCollapsible()).toBe(false)
  })

  it('serializes to schema', () => {
    const schema = NavigationGroup.make('Admin')
      .icon('shield')
      .collapsible()
      .items([
        NavigationItem.make('Users').url('/users'),
      ])
      .toSchema()

    expect(schema.label).toBe('Admin')
    expect(schema.icon).toBe('shield')
    expect(schema.collapsible).toBe(true)
    const items = schema.items as Record<string, unknown>[]
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('Users')
  })

  it('serializes items with full schema', () => {
    const schema = NavigationGroup.make('Content')
      .items([
        NavigationItem.make('Posts').icon('file').url('/posts').badge(5),
      ])
      .toSchema()

    const items = schema.items as Record<string, unknown>[]
    expect(items[0].icon).toBe('file')
    expect(items[0].url).toBe('/posts')
    expect(items[0].badge).toBe(5)
  })
})

describe('NavigationBuilder', () => {
  describe('buildFromResources', () => {
    it('groups resources by navigationGroup', () => {
      const result = NavigationBuilder.buildFromResources([
        UserResource as unknown as typeof Resource,
        PostResource as unknown as typeof Resource,
        PageResource as unknown as typeof Resource,
      ])

      // Should have Admin and Content groups
      const groupLabels = result.map(g => g.label)
      expect(groupLabels).toContain('Admin')
      expect(groupLabels).toContain('Content')
    })

    it('puts ungrouped resources in default group', () => {
      const result = NavigationBuilder.buildFromResources([
        SettingResource as unknown as typeof Resource,
      ])

      // Ungrouped items go in empty-string group first
      expect(result[0].label).toBe('')
      expect(result[0].items).toHaveLength(1)
      expect(result[0].items[0].label).toBe('Settings')
    })

    it('sorts resources by navigationSort then label', () => {
      const result = NavigationBuilder.buildFromResources([
        PostResource as unknown as typeof Resource,
        PageResource as unknown as typeof Resource,
      ])

      const contentGroup = result.find(g => g.label === 'Content')!
      // PostResource (sort=0) should come before PageResource (sort=1)
      expect(contentGroup.items[0].label).toBe('Posts')
      expect(contentGroup.items[1].label).toBe('Pages')
    })

    it('generates correct URLs', () => {
      const result = NavigationBuilder.buildFromResources([
        UserResource as unknown as typeof Resource,
      ])

      const adminGroup = result.find(g => g.label === 'Admin')!
      expect(adminGroup.items[0].url).toBe('/resources/users')
    })

    it('uses resource icon', () => {
      const result = NavigationBuilder.buildFromResources([
        UserResource as unknown as typeof Resource,
      ])

      const adminGroup = result.find(g => g.label === 'Admin')!
      expect(adminGroup.items[0].icon).toBe('users')
    })

    it('handles empty resources array', () => {
      const result = NavigationBuilder.buildFromResources([])
      expect(result).toEqual([])
    })

    it('sorts named groups alphabetically', () => {
      const result = NavigationBuilder.buildFromResources([
        UserResource as unknown as typeof Resource,
        PostResource as unknown as typeof Resource,
      ])

      const namedGroups = result.filter(g => g.label !== '')
      expect(namedGroups[0].label).toBe('Admin')
      expect(namedGroups[1].label).toBe('Content')
    })

    it('ungrouped items come first', () => {
      const result = NavigationBuilder.buildFromResources([
        SettingResource as unknown as typeof Resource,
        UserResource as unknown as typeof Resource,
      ])

      expect(result[0].label).toBe('')
      expect(result[1].label).toBe('Admin')
    })

    it('sets collapsible for named groups', () => {
      const result = NavigationBuilder.buildFromResources([
        UserResource as unknown as typeof Resource,
      ])

      const adminGroup = result.find(g => g.label === 'Admin')!
      expect(adminGroup.collapsible).toBe(true)
    })

    it('ungrouped group is not collapsible', () => {
      const result = NavigationBuilder.buildFromResources([
        SettingResource as unknown as typeof Resource,
      ])

      expect(result[0].collapsible).toBe(false)
    })
  })

  describe('build with explicit groups', () => {
    it('uses explicit groups when provided', () => {
      const groups = [
        NavigationGroup.make('Custom')
          .icon('star')
          .items([NavigationItem.make('Custom Item').url('/custom')]),
      ]

      const result = NavigationBuilder.build(
        [SettingResource as unknown as typeof Resource],
        groups,
      )

      expect(result[0].label).toBe('Custom')
    })

    it('appends uncovered resources after explicit groups', () => {
      const groups = [
        NavigationGroup.make('Main')
          .items([NavigationItem.make('Dashboard').url('/dashboard')]),
      ]

      const result = NavigationBuilder.build(
        [SettingResource as unknown as typeof Resource],
        groups,
      )

      // First the explicit group, then the ungrouped Settings resource
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result[0].label).toBe('Main')
    })
  })
})
