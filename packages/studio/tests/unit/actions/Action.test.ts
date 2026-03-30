// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { Action } from '../../../src/actions/Action.ts'
import { DeleteAction } from '../../../src/actions/DeleteAction.ts'
import { ViewAction } from '../../../src/actions/ViewAction.ts'
import { EditAction } from '../../../src/actions/EditAction.ts'
import { CreateAction } from '../../../src/actions/CreateAction.ts'
import { BulkAction } from '../../../src/actions/BulkAction.ts'
import { BulkDeleteAction } from '../../../src/actions/BulkDeleteAction.ts'
import { TextInput } from '../../../src/forms/components/TextInput.ts'

// Concrete Action subclass for testing the abstract base
class TestAction extends Action {
  static make(name: string): TestAction {
    return new TestAction(name)
  }

  override handle(_record: Record<string, unknown>): { type: 'success' | 'failure' | 'redirect'; message: string | undefined; redirectUrl: string | undefined } {
    return { type: 'success', message: 'Done', redirectUrl: undefined }
  }
}

// Concrete BulkAction subclass for testing the abstract base
class TestBulkAction extends BulkAction {
  static make(name: string): TestBulkAction {
    return new TestBulkAction(name)
  }

  override handle(_records: Record<string, unknown>[]): { type: 'success' | 'failure' | 'redirect'; message: string | undefined; redirectUrl: string | undefined } {
    return { type: 'success', message: 'Bulk done', redirectUrl: undefined }
  }
}

describe('Action (base)', () => {
  it('sets label', () => {
    const schema = TestAction.make('approve').label('Approve').toSchema()
    expect(schema.label).toBe('Approve')
    expect(schema.name).toBe('approve')
  })

  it('sets icon', () => {
    const schema = TestAction.make('export').icon('download').toSchema()
    expect(schema.icon).toBe('download')
  })

  it('sets color', () => {
    const schema = TestAction.make('warn').color('warning').toSchema()
    expect(schema.color).toBe('warning')
  })

  it('defaults color to primary', () => {
    const schema = TestAction.make('test').toSchema()
    expect(schema.color).toBe('primary')
  })

  it('enables requiresConfirmation', () => {
    const schema = TestAction.make('archive').requiresConfirmation().toSchema()
    expect(schema.requiresConfirmation).toBe(true)
  })

  it('defaults requiresConfirmation to false', () => {
    const schema = TestAction.make('test').toSchema()
    expect(schema.requiresConfirmation).toBe(false)
  })

  it('sets custom confirmation config', () => {
    const schema = TestAction.make('ban')
      .confirmation({
        title: 'Ban User',
        description: 'This will permanently ban the user.',
        confirmLabel: 'Yes, ban',
        cancelLabel: 'No, keep',
      })
      .toSchema()

    expect(schema.requiresConfirmation).toBe(true)
    const conf = schema.confirmation as Record<string, unknown>
    expect(conf.title).toBe('Ban User')
    expect(conf.description).toBe('This will permanently ban the user.')
    expect(conf.confirmLabel).toBe('Yes, ban')
    expect(conf.cancelLabel).toBe('No, keep')
  })

  it('omits confirmation when not required', () => {
    const schema = TestAction.make('test').toSchema()
    expect(schema.confirmation).toBeUndefined()
  })

  it('sets modal form', () => {
    const schema = TestAction.make('reject')
      .modalForm([TextInput.make('reason').required()])
      .toSchema()

    const form = schema.modalForm as Record<string, unknown>[]
    expect(form).toHaveLength(1)
    expect(form[0].name).toBe('reason')
  })

  it('handles authorization callback', () => {
    const action = TestAction.make('delete')
      .authorize((record) => record.status === 'draft')

    expect(action.isAuthorized({ status: 'draft' })).toBe(true)
    expect(action.isAuthorized({ status: 'published' })).toBe(false)
  })

  it('defaults authorization to true', () => {
    const action = TestAction.make('test')
    expect(action.isAuthorized({})).toBe(true)
  })

  it('sets successNotification', () => {
    const schema = TestAction.make('send')
      .successNotification('Email sent!')
      .toSchema()
    expect(schema.successNotification).toBe('Email sent!')
  })

  it('executes handle method', () => {
    const action = TestAction.make('approve')
    const result = action.handle({ id: 1 })
    expect(result.type).toBe('success')
    expect(result.message).toBe('Done')
  })
})

describe('DeleteAction', () => {
  it('creates with default settings', () => {
    const action = DeleteAction.make()
    const schema = action.toSchema()
    expect(schema.name).toBe('delete')
    expect(schema.label).toBe('Delete')
    expect(schema.icon).toBe('trash')
    expect(schema.color).toBe('danger')
    expect(schema.requiresConfirmation).toBe(true)
  })

  it('has confirmation with descriptive title', () => {
    const schema = DeleteAction.make().toSchema()
    const conf = schema.confirmation as Record<string, unknown>
    expect(conf.title).toBe('Delete record')
    expect(conf.confirmLabel).toBe('Delete')
  })

  it('executes handle method', () => {
    const result = DeleteAction.make().handle({ id: 1 })
    expect(result.type).toBe('success')
    expect(result.message).toBe('Record deleted successfully.')
  })

  it('accepts custom name', () => {
    const schema = DeleteAction.make('remove').toSchema()
    expect(schema.name).toBe('remove')
  })
})

describe('ViewAction', () => {
  it('creates with default settings', () => {
    const schema = ViewAction.make().toSchema()
    expect(schema.name).toBe('view')
    expect(schema.label).toBe('View')
    expect(schema.icon).toBe('eye')
    expect(schema.color).toBe('secondary')
    expect(schema.requiresConfirmation).toBe(false)
  })

  it('executes handle method', () => {
    const result = ViewAction.make().handle({ id: 1 })
    expect(result.type).toBe('success')
  })
})

describe('EditAction', () => {
  it('creates with default settings', () => {
    const schema = EditAction.make().toSchema()
    expect(schema.name).toBe('edit')
    expect(schema.label).toBe('Edit')
    expect(schema.icon).toBe('pencil')
    expect(schema.color).toBe('primary')
  })

  it('executes handle method', () => {
    const result = EditAction.make().handle({ id: 1 })
    expect(result.type).toBe('success')
    expect(result.message).toBe('Record updated successfully.')
  })
})

describe('CreateAction', () => {
  it('creates with default settings', () => {
    const schema = CreateAction.make().toSchema()
    expect(schema.name).toBe('create')
    expect(schema.label).toBe('Create')
    expect(schema.icon).toBe('plus')
    expect(schema.color).toBe('primary')
  })

  it('executes handle method', () => {
    const result = CreateAction.make().handle({})
    expect(result.type).toBe('success')
    expect(result.message).toBe('Record created successfully.')
  })
})

describe('BulkAction (base)', () => {
  it('sets label', () => {
    const schema = TestBulkAction.make('export').label('Export Selected').toSchema()
    expect(schema.label).toBe('Export Selected')
  })

  it('sets icon', () => {
    const schema = TestBulkAction.make('export').icon('download').toSchema()
    expect(schema.icon).toBe('download')
  })

  it('sets color', () => {
    const schema = TestBulkAction.make('archive').color('warning').toSchema()
    expect(schema.color).toBe('warning')
  })

  it('enables requiresConfirmation', () => {
    const schema = TestBulkAction.make('delete').requiresConfirmation().toSchema()
    expect(schema.requiresConfirmation).toBe(true)
  })

  it('sets custom confirmation', () => {
    const schema = TestBulkAction.make('purge')
      .confirmation({ title: 'Purge All' })
      .toSchema()
    expect(schema.requiresConfirmation).toBe(true)
    const conf = schema.confirmation as Record<string, unknown>
    expect(conf.title).toBe('Purge All')
  })

  it('sets successNotification', () => {
    const schema = TestBulkAction.make('export')
      .successNotification('Export complete!')
      .toSchema()
    expect(schema.successNotification).toBe('Export complete!')
  })

  it('sets deselectRecordsAfterCompletion', () => {
    const schema = TestBulkAction.make('tag')
      .deselectRecordsAfterCompletion(false)
      .toSchema()
    expect(schema.deselectRecordsAfterCompletion).toBe(false)
  })

  it('defaults deselectRecordsAfterCompletion to true', () => {
    const schema = TestBulkAction.make('test').toSchema()
    expect(schema.deselectRecordsAfterCompletion).toBe(true)
  })

  it('sets modalForm', () => {
    const schema = TestBulkAction.make('assign')
      .modalForm([TextInput.make('assignee')])
      .toSchema()
    const form = schema.modalForm as Record<string, unknown>[]
    expect(form).toHaveLength(1)
  })
})

describe('BulkDeleteAction', () => {
  it('creates with default settings', () => {
    const schema = BulkDeleteAction.make().toSchema()
    expect(schema.name).toBe('bulk-delete')
    expect(schema.label).toBe('Delete selected')
    expect(schema.icon).toBe('trash')
    expect(schema.color).toBe('danger')
    expect(schema.requiresConfirmation).toBe(true)
  })

  it('has descriptive confirmation', () => {
    const schema = BulkDeleteAction.make().toSchema()
    const conf = schema.confirmation as Record<string, unknown>
    expect(conf.title).toBe('Delete selected records')
  })

  it('executes handle method', () => {
    const result = BulkDeleteAction.make().handle([{ id: 1 }, { id: 2 }])
    expect(result.type).toBe('success')
    expect(result.message).toBe('Records deleted successfully.')
  })
})
