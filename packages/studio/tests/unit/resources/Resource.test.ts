// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { Resource } from '../../../src/resources/Resource.ts'
import { Form } from '../../../src/forms/Form.ts'
import { TextInput } from '../../../src/forms/components/TextInput.ts'
import { Table } from '../../../src/tables/Table.ts'
import { TextColumn } from '../../../src/tables/columns/TextColumn.ts'

// Concrete Resource subclass for testing
class UserResource extends Resource {
  static override model = class User {}
  static override navigationIcon = 'users'
  static override navigationGroup = 'Administration'
  static override navigationSort = 1
  static override navigationLabel = 'Users'
  static override slug = 'users'
  static override recordTitleAttribute = 'name'
  static override globallySearchable = true
  static override softDeletes = true

  override form() {
    return Form.make([
      TextInput.make('name').required(),
      TextInput.make('email').email(),
    ])
  }

  override table() {
    return Table.make([
      TextColumn.make('name').sortable().searchable(),
      TextColumn.make('email').sortable(),
    ])
  }
}

// Resource with no explicit slug/label to test derivation
class ProductCategoryResource extends Resource {
  static override model = class ProductCategory {}

  override form() {
    return Form.make([TextInput.make('name')])
  }

  override table() {
    return Table.make([TextColumn.make('name')])
  }
}

// Resource with a name ending in 's'
class StatusResource extends Resource {
  static override model = class Status {}

  override form() {
    return Form.make([TextInput.make('name')])
  }

  override table() {
    return Table.make([TextColumn.make('name')])
  }
}

describe('Resource', () => {
  describe('static defaults', () => {
    it('defaults navigationIcon to file', () => {
      expect(Resource.navigationIcon).toBe('file')
    })

    it('defaults navigationGroup to empty string', () => {
      expect(Resource.navigationGroup).toBe('')
    })

    it('defaults navigationSort to 0', () => {
      expect(Resource.navigationSort).toBe(0)
    })

    it('defaults navigationLabel to empty string', () => {
      expect(Resource.navigationLabel).toBe('')
    })

    it('defaults slug to empty string', () => {
      expect(Resource.slug).toBe('')
    })

    it('defaults recordTitleAttribute to id', () => {
      expect(Resource.recordTitleAttribute).toBe('id')
    })

    it('defaults globallySearchable to true', () => {
      expect(Resource.globallySearchable).toBe(true)
    })

    it('defaults softDeletes to false', () => {
      expect(Resource.softDeletes).toBe(false)
    })
  })

  describe('static overrides', () => {
    it('uses overridden navigationIcon', () => {
      expect(UserResource.navigationIcon).toBe('users')
    })

    it('uses overridden navigationGroup', () => {
      expect(UserResource.navigationGroup).toBe('Administration')
    })

    it('uses overridden slug', () => {
      expect(UserResource.slug).toBe('users')
    })

    it('uses overridden recordTitleAttribute', () => {
      expect(UserResource.recordTitleAttribute).toBe('name')
    })

    it('uses overridden softDeletes', () => {
      expect(UserResource.softDeletes).toBe(true)
    })
  })

  describe('slug derivation', () => {
    it('uses explicit slug when set', () => {
      expect(UserResource.resolveSlug()).toBe('users')
    })

    it('derives slug from class name', () => {
      expect(ProductCategoryResource.resolveSlug()).toBe('product-categories')
    })

    it('does not double-pluralize names ending in s', () => {
      expect(StatusResource.resolveSlug()).toBe('statuses')
    })
  })

  describe('label derivation', () => {
    it('uses explicit navigationLabel when set', () => {
      expect(UserResource.resolveLabel()).toBe('Users')
    })

    it('derives label from class name', () => {
      expect(ProductCategoryResource.resolveLabel()).toBe('Product Categories')
    })

    it('does not double-pluralize names ending in s', () => {
      expect(StatusResource.resolveLabel()).toBe('Statuses')
    })
  })

  describe('lifecycle hooks', () => {
    it('beforeCreate returns data by default', () => {
      const resource = new UserResource()
      const data = { name: 'John' }
      expect(resource.beforeCreate(data)).toEqual(data)
    })

    it('afterCreate is a no-op by default', () => {
      const resource = new UserResource()
      expect(resource.afterCreate({ id: 1 })).toBeUndefined()
    })

    it('beforeSave returns data by default', () => {
      const resource = new UserResource()
      const data = { name: 'Jane' }
      expect(resource.beforeSave({ id: 1 }, data)).toEqual(data)
    })

    it('afterSave is a no-op by default', () => {
      const resource = new UserResource()
      expect(resource.afterSave({ id: 1 })).toBeUndefined()
    })

    it('beforeDelete is a no-op by default', () => {
      const resource = new UserResource()
      expect(resource.beforeDelete({ id: 1 })).toBeUndefined()
    })

    it('afterDelete is a no-op by default', () => {
      const resource = new UserResource()
      expect(resource.afterDelete({ id: 1 })).toBeUndefined()
    })
  })

  describe('lifecycle hooks can be overridden', () => {
    class CustomResource extends Resource {
      static override model = class Custom {}

      override form() {
        return Form.make([TextInput.make('name')])
      }

      override table() {
        return Table.make([TextColumn.make('name')])
      }

      override beforeCreate(data: Record<string, any>) {
        return { ...data, slug: 'auto-generated' }
      }
    }

    it('uses overridden beforeCreate', () => {
      const resource = new CustomResource()
      const result = resource.beforeCreate({ name: 'Test' })
      expect(result).toEqual({ name: 'Test', slug: 'auto-generated' })
    })
  })

  describe('query scoping', () => {
    it('modifyQuery returns query unchanged by default', () => {
      const resource = new UserResource()
      const query = { where: 'clause' }
      expect(resource.modifyQuery(query)).toBe(query)
    })

    it('eagerLoad returns empty array by default', () => {
      const resource = new UserResource()
      expect(resource.eagerLoad()).toEqual([])
    })
  })

  describe('authorization defaults', () => {
    it('canViewAny defaults to true', () => {
      expect(Resource.canViewAny({})).toBe(true)
    })

    it('canView defaults to true', () => {
      expect(Resource.canView({}, {})).toBe(true)
    })

    it('canCreate defaults to true', () => {
      expect(Resource.canCreate({})).toBe(true)
    })

    it('canUpdate defaults to true', () => {
      expect(Resource.canUpdate({}, {})).toBe(true)
    })

    it('canDelete defaults to true', () => {
      expect(Resource.canDelete({}, {})).toBe(true)
    })

    it('canRestore defaults to true', () => {
      expect(Resource.canRestore({}, {})).toBe(true)
    })

    it('canForceDelete defaults to true', () => {
      expect(Resource.canForceDelete({}, {})).toBe(true)
    })
  })

  describe('optional defaults', () => {
    it('relationManagers returns empty array by default', () => {
      const resource = new UserResource()
      expect(resource.relationManagers()).toEqual([])
    })

    it('pages returns empty object by default', () => {
      const resource = new UserResource()
      expect(resource.pages()).toEqual({})
    })

    it('headerWidgets returns empty array by default', () => {
      const resource = new UserResource()
      expect(resource.headerWidgets()).toEqual([])
    })

    it('footerWidgets returns empty array by default', () => {
      const resource = new UserResource()
      expect(resource.footerWidgets()).toEqual([])
    })
  })

  describe('toSchema', () => {
    it('serializes resource to schema object', () => {
      const resource = new UserResource()
      const schema = resource.toSchema()

      expect(schema.slug).toBe('users')
      expect(schema.label).toBe('Users')
      expect(schema.navigationIcon).toBe('users')
      expect(schema.navigationGroup).toBe('Administration')
      expect(schema.navigationSort).toBe(1)
      expect(schema.recordTitleAttribute).toBe('name')
      expect(schema.globallySearchable).toBe(true)
      expect(schema.softDeletes).toBe(true)
    })

    it('includes form schema', () => {
      const resource = new UserResource()
      const schema = resource.toSchema()
      const form = schema.form as Record<string, unknown>
      expect(form.type).toBe('form')
      const components = form.components as Record<string, unknown>[]
      expect(components).toHaveLength(2)
    })

    it('includes table schema', () => {
      const resource = new UserResource()
      const schema = resource.toSchema()
      const table = schema.table as Record<string, unknown>
      expect(table.type).toBe('table')
      const columns = table.columns as Record<string, unknown>[]
      expect(columns).toHaveLength(2)
    })
  })
})
