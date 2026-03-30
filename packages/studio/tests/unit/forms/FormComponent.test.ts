// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { TextInput } from '../../../src/forms/components/TextInput.ts'
import { Textarea } from '../../../src/forms/components/Textarea.ts'
import { Select } from '../../../src/forms/components/Select.ts'
import { Toggle } from '../../../src/forms/components/Toggle.ts'
import { Checkbox } from '../../../src/forms/components/Checkbox.ts'
import { Radio } from '../../../src/forms/components/Radio.ts'
import { DatePicker } from '../../../src/forms/components/DatePicker.ts'
import { FileUpload } from '../../../src/forms/components/FileUpload.ts'
import { Repeater } from '../../../src/forms/components/Repeater.ts'
import { Hidden } from '../../../src/forms/components/Hidden.ts'
import { Placeholder } from '../../../src/forms/components/Placeholder.ts'
import { TagsInput } from '../../../src/forms/components/TagsInput.ts'
import { KeyValue } from '../../../src/forms/components/KeyValue.ts'
import { CheckboxList } from '../../../src/forms/components/CheckboxList.ts'
import { ColorPicker } from '../../../src/forms/components/ColorPicker.ts'
import { Form } from '../../../src/forms/Form.ts'

describe('TextInput', () => {
  it('creates via static make', () => {
    const input = TextInput.make('name')
    const schema = input.toSchema()
    expect(schema.type).toBe('text-input')
    expect(schema.name).toBe('name')
  })

  it('sets label', () => {
    const schema = TextInput.make('name').label('Full Name').toSchema()
    expect(schema.label).toBe('Full Name')
  })

  it('sets email type', () => {
    const schema = TextInput.make('email').email().toSchema()
    expect(schema.inputType).toBe('email')
  })

  it('sets password type', () => {
    const schema = TextInput.make('password').password().toSchema()
    expect(schema.inputType).toBe('password')
  })

  it('sets tel type', () => {
    const schema = TextInput.make('phone').tel().toSchema()
    expect(schema.inputType).toBe('tel')
  })

  it('sets url type', () => {
    const schema = TextInput.make('website').url().toSchema()
    expect(schema.inputType).toBe('url')
  })

  it('sets numeric type', () => {
    const schema = TextInput.make('age').numeric().toSchema()
    expect(schema.inputType).toBe('number')
  })

  it('sets maxLength', () => {
    const schema = TextInput.make('name').maxLength(100).toSchema()
    expect(schema.maxLength).toBe(100)
  })

  it('sets minLength', () => {
    const schema = TextInput.make('name').minLength(3).toSchema()
    expect(schema.minLength).toBe(3)
  })

  it('sets prefix and suffix', () => {
    const schema = TextInput.make('price').prefix('$').suffix('.00').toSchema()
    expect(schema.prefix).toBe('$')
    expect(schema.suffix).toBe('.00')
  })

  it('sets mask', () => {
    const schema = TextInput.make('phone').mask('(###) ###-####').toSchema()
    expect(schema.mask).toBe('(###) ###-####')
  })

  it('chains multiple methods fluently', () => {
    const schema = TextInput.make('email')
      .label('Email Address')
      .email()
      .required()
      .placeholder('Enter email')
      .maxLength(255)
      .toSchema()

    expect(schema.name).toBe('email')
    expect(schema.label).toBe('Email Address')
    expect(schema.inputType).toBe('email')
    expect(schema.required).toBe(true)
    expect(schema.placeholder).toBe('Enter email')
    expect(schema.maxLength).toBe(255)
  })

  it('includes base component properties in schema', () => {
    const schema = TextInput.make('field')
      .helperText('Help text')
      .hint('A hint')
      .default('default_value')
      .disabled()
      .hidden()
      .rules(['required', 'min:3'])
      .columnSpan(2)
      .reactive()
      .dependsOn(['other_field'])
      .toSchema()

    expect(schema.helperText).toBe('Help text')
    expect(schema.hint).toBe('A hint')
    expect(schema.default).toBe('default_value')
    expect(schema.disabled).toBe(true)
    expect(schema.hidden).toBe(true)
    expect(schema.rules).toEqual(['required', 'min:3'])
    expect(schema.columnSpan).toBe(2)
    expect(schema.reactive).toBe(true)
    expect(schema.dependsOn).toEqual(['other_field'])
  })

  it('defaults inputType to text', () => {
    const schema = TextInput.make('name').toSchema()
    expect(schema.inputType).toBe('text')
  })

  it('defaults required to false', () => {
    const schema = TextInput.make('name').toSchema()
    expect(schema.required).toBe(false)
  })

  it('defaults disabled to false', () => {
    const schema = TextInput.make('name').toSchema()
    expect(schema.disabled).toBe(false)
  })
})

describe('Textarea', () => {
  it('creates via static make', () => {
    const schema = Textarea.make('description').toSchema()
    expect(schema.type).toBe('textarea')
    expect(schema.name).toBe('description')
  })

  it('sets rows', () => {
    const schema = Textarea.make('bio').rows(5).toSchema()
    expect(schema.rows).toBe(5)
  })

  it('enables autosize', () => {
    const schema = Textarea.make('bio').autosize().toSchema()
    expect(schema.autosize).toBe(true)
  })

  it('defaults autosize to false', () => {
    const schema = Textarea.make('bio').toSchema()
    expect(schema.autosize).toBe(false)
  })

  it('chains with base methods', () => {
    const schema = Textarea.make('notes')
      .label('Notes')
      .rows(10)
      .autosize()
      .placeholder('Enter notes...')
      .required()
      .toSchema()

    expect(schema.label).toBe('Notes')
    expect(schema.rows).toBe(10)
    expect(schema.autosize).toBe(true)
    expect(schema.placeholder).toBe('Enter notes...')
    expect(schema.required).toBe(true)
  })
})

describe('Select', () => {
  it('creates via static make', () => {
    const schema = Select.make('role').toSchema()
    expect(schema.type).toBe('select')
    expect(schema.name).toBe('role')
  })

  it('sets static options', () => {
    const schema = Select.make('role')
      .options({ admin: 'Admin', user: 'User' })
      .toSchema()
    expect(schema.options).toEqual({ admin: 'Admin', user: 'User' })
  })

  it('enables searchable', () => {
    const schema = Select.make('role').searchable().toSchema()
    expect(schema.searchable).toBe(true)
  })

  it('enables multiple', () => {
    const schema = Select.make('tags').multiple().toSchema()
    expect(schema.multiple).toBe(true)
  })

  it('sets relationship', () => {
    const schema = Select.make('author_id').relationship('author').toSchema()
    expect(schema.relationship).toBe('author')
  })

  it('enables preload', () => {
    const schema = Select.make('category_id').preload().toSchema()
    expect(schema.preload).toBe(true)
  })

  it('enables native', () => {
    const schema = Select.make('type').native().toSchema()
    expect(schema.native).toBe(true)
  })

  it('defaults to not searchable', () => {
    const schema = Select.make('role').toSchema()
    expect(schema.searchable).toBe(false)
  })

  it('defaults to not multiple', () => {
    const schema = Select.make('role').toSchema()
    expect(schema.multiple).toBe(false)
  })
})

describe('Toggle', () => {
  it('creates via static make', () => {
    const schema = Toggle.make('is_active').toSchema()
    expect(schema.type).toBe('toggle')
    expect(schema.name).toBe('is_active')
  })

  it('sets on/off labels', () => {
    const schema = Toggle.make('active')
      .onLabel('Enabled')
      .offLabel('Disabled')
      .toSchema()
    expect(schema.onLabel).toBe('Enabled')
    expect(schema.offLabel).toBe('Disabled')
  })

  it('sets on/off colors', () => {
    const schema = Toggle.make('active')
      .onColor('green')
      .offColor('red')
      .toSchema()
    expect(schema.onColor).toBe('green')
    expect(schema.offColor).toBe('red')
  })
})

describe('Checkbox', () => {
  it('creates via static make', () => {
    const schema = Checkbox.make('agree').toSchema()
    expect(schema.type).toBe('checkbox')
    expect(schema.name).toBe('agree')
  })

  it('sets inline', () => {
    const schema = Checkbox.make('agree').inline().toSchema()
    expect(schema.inline).toBe(true)
  })

  it('defaults inline to false', () => {
    const schema = Checkbox.make('agree').toSchema()
    expect(schema.inline).toBe(false)
  })
})

describe('Radio', () => {
  it('creates via static make', () => {
    const schema = Radio.make('gender').toSchema()
    expect(schema.type).toBe('radio')
    expect(schema.name).toBe('gender')
  })

  it('sets options', () => {
    const schema = Radio.make('gender')
      .options({ male: 'Male', female: 'Female' })
      .toSchema()
    expect(schema.options).toEqual({ male: 'Male', female: 'Female' })
  })

  it('sets inline', () => {
    const schema = Radio.make('gender').inline().toSchema()
    expect(schema.inline).toBe(true)
  })
})

describe('DatePicker', () => {
  it('creates via static make', () => {
    const schema = DatePicker.make('birthday').toSchema()
    expect(schema.type).toBe('date-picker')
    expect(schema.name).toBe('birthday')
  })

  it('sets format', () => {
    const schema = DatePicker.make('date').format('YYYY-MM-DD').toSchema()
    expect(schema.format).toBe('YYYY-MM-DD')
  })

  it('sets minDate', () => {
    const schema = DatePicker.make('date').minDate('2024-01-01').toSchema()
    expect(schema.minDate).toBe('2024-01-01')
  })

  it('sets maxDate', () => {
    const schema = DatePicker.make('date').maxDate('2025-12-31').toSchema()
    expect(schema.maxDate).toBe('2025-12-31')
  })

  it('enables withTime', () => {
    const schema = DatePicker.make('starts_at').withTime().toSchema()
    expect(schema.withTime).toBe(true)
  })

  it('defaults withTime to false', () => {
    const schema = DatePicker.make('date').toSchema()
    expect(schema.withTime).toBe(false)
  })

  it('chains all options', () => {
    const schema = DatePicker.make('event_date')
      .format('DD/MM/YYYY')
      .minDate('2024-01-01')
      .maxDate('2024-12-31')
      .withTime()
      .required()
      .toSchema()

    expect(schema.format).toBe('DD/MM/YYYY')
    expect(schema.minDate).toBe('2024-01-01')
    expect(schema.maxDate).toBe('2024-12-31')
    expect(schema.withTime).toBe(true)
    expect(schema.required).toBe(true)
  })
})

describe('FileUpload', () => {
  it('creates via static make', () => {
    const schema = FileUpload.make('avatar').toSchema()
    expect(schema.type).toBe('file-upload')
    expect(schema.name).toBe('avatar')
  })

  it('sets accept', () => {
    const schema = FileUpload.make('photo').accept('image/*').toSchema()
    expect(schema.accept).toBe('image/*')
  })

  it('sets maxSize', () => {
    const schema = FileUpload.make('doc').maxSize(10240).toSchema()
    expect(schema.maxSize).toBe(10240)
  })

  it('enables multiple', () => {
    const schema = FileUpload.make('files').multiple().toSchema()
    expect(schema.multiple).toBe(true)
  })

  it('sets disk', () => {
    const schema = FileUpload.make('file').disk('s3').toSchema()
    expect(schema.disk).toBe('s3')
  })

  it('sets directory', () => {
    const schema = FileUpload.make('file').directory('uploads').toSchema()
    expect(schema.directory).toBe('uploads')
  })

  it('enables imagePreview', () => {
    const schema = FileUpload.make('avatar').imagePreview().toSchema()
    expect(schema.imagePreview).toBe(true)
  })

  it('defaults multiple to false', () => {
    const schema = FileUpload.make('file').toSchema()
    expect(schema.multiple).toBe(false)
  })
})

describe('Repeater', () => {
  it('creates via static make', () => {
    const schema = Repeater.make('items').toSchema()
    expect(schema.type).toBe('repeater')
    expect(schema.name).toBe('items')
  })

  it('sets nested schema', () => {
    const schema = Repeater.make('items')
      .schema([
        TextInput.make('name'),
        TextInput.make('quantity').numeric(),
      ])
      .toSchema()

    expect(schema.schema).toHaveLength(2)
    const items = schema.schema as Record<string, unknown>[]
    expect(items[0].name).toBe('name')
    expect(items[1].name).toBe('quantity')
  })

  it('sets minItems', () => {
    const schema = Repeater.make('items').minItems(1).toSchema()
    expect(schema.minItems).toBe(1)
  })

  it('sets maxItems', () => {
    const schema = Repeater.make('items').maxItems(5).toSchema()
    expect(schema.maxItems).toBe(5)
  })

  it('enables collapsible', () => {
    const schema = Repeater.make('items').collapsible().toSchema()
    expect(schema.collapsible).toBe(true)
  })

  it('sets reorderable', () => {
    const schema = Repeater.make('items').reorderable(false).toSchema()
    expect(schema.reorderable).toBe(false)
  })

  it('defaults reorderable to true', () => {
    const schema = Repeater.make('items').toSchema()
    expect(schema.reorderable).toBe(true)
  })

  it('sets addActionLabel', () => {
    const schema = Repeater.make('items').addActionLabel('Add new row').toSchema()
    expect(schema.addActionLabel).toBe('Add new row')
  })

  it('defaults addActionLabel', () => {
    const schema = Repeater.make('items').toSchema()
    expect(schema.addActionLabel).toBe('Add item')
  })
})

describe('Hidden', () => {
  it('creates via static make', () => {
    const schema = Hidden.make('secret_id').toSchema()
    expect(schema.type).toBe('hidden')
    expect(schema.name).toBe('secret_id')
  })

  it('accepts a default value', () => {
    const schema = Hidden.make('token').default('abc123').toSchema()
    expect(schema.default).toBe('abc123')
  })
})

describe('Placeholder', () => {
  it('creates via static make', () => {
    const schema = Placeholder.make('info').toSchema()
    expect(schema.type).toBe('placeholder')
    expect(schema.name).toBe('info')
  })

  it('sets content', () => {
    const schema = Placeholder.make('info').content('Some informational text').toSchema()
    expect(schema.content).toBe('Some informational text')
  })
})

describe('TagsInput', () => {
  it('creates via static make', () => {
    const schema = TagsInput.make('tags').toSchema()
    expect(schema.type).toBe('tags-input')
    expect(schema.name).toBe('tags')
  })

  it('sets suggestions', () => {
    const schema = TagsInput.make('tags')
      .suggestions(['PHP', 'JS', 'TypeScript'])
      .toSchema()
    expect(schema.suggestions).toEqual(['PHP', 'JS', 'TypeScript'])
  })

  it('sets separator', () => {
    const schema = TagsInput.make('tags').separator(',').toSchema()
    expect(schema.separator).toBe(',')
  })
})

describe('KeyValue', () => {
  it('creates via static make', () => {
    const schema = KeyValue.make('metadata').toSchema()
    expect(schema.type).toBe('key-value')
    expect(schema.name).toBe('metadata')
  })

  it('sets keyLabel', () => {
    const schema = KeyValue.make('meta').keyLabel('Property').toSchema()
    expect(schema.keyLabel).toBe('Property')
  })

  it('sets valueLabel', () => {
    const schema = KeyValue.make('meta').valueLabel('Data').toSchema()
    expect(schema.valueLabel).toBe('Data')
  })

  it('sets addActionLabel', () => {
    const schema = KeyValue.make('meta').addActionLabel('New entry').toSchema()
    expect(schema.addActionLabel).toBe('New entry')
  })

  it('enables reorderable', () => {
    const schema = KeyValue.make('meta').reorderable().toSchema()
    expect(schema.reorderable).toBe(true)
  })

  it('defaults reorderable to false', () => {
    const schema = KeyValue.make('meta').toSchema()
    expect(schema.reorderable).toBe(false)
  })

  it('has default labels', () => {
    const schema = KeyValue.make('meta').toSchema()
    expect(schema.keyLabel).toBe('Key')
    expect(schema.valueLabel).toBe('Value')
    expect(schema.addActionLabel).toBe('Add row')
  })
})

describe('CheckboxList', () => {
  it('creates via static make', () => {
    const schema = CheckboxList.make('permissions').toSchema()
    expect(schema.type).toBe('checkbox-list')
    expect(schema.name).toBe('permissions')
  })

  it('sets options', () => {
    const schema = CheckboxList.make('perms')
      .options({ read: 'Read', write: 'Write' })
      .toSchema()
    expect(schema.options).toEqual({ read: 'Read', write: 'Write' })
  })

  it('sets columns', () => {
    const schema = CheckboxList.make('perms').columns(3).toSchema()
    expect(schema.columns).toBe(3)
  })

  it('enables searchable', () => {
    const schema = CheckboxList.make('perms').searchable().toSchema()
    expect(schema.searchable).toBe(true)
  })
})

describe('ColorPicker', () => {
  it('creates via static make', () => {
    const schema = ColorPicker.make('color').toSchema()
    expect(schema.type).toBe('color-picker')
    expect(schema.name).toBe('color')
  })

  it('defaults format to hex', () => {
    const schema = ColorPicker.make('color').toSchema()
    expect(schema.format).toBe('hex')
  })

  it('sets format to rgb', () => {
    const schema = ColorPicker.make('color').format('rgb').toSchema()
    expect(schema.format).toBe('rgb')
  })

  it('sets format to hsl', () => {
    const schema = ColorPicker.make('color').format('hsl').toSchema()
    expect(schema.format).toBe('hsl')
  })
})

describe('Form', () => {
  it('creates via static make', () => {
    const form = Form.make([TextInput.make('name')])
    const schema = form.toSchema()
    expect(schema.type).toBe('form')
    expect(schema.columns).toBe(1)
  })

  it('serializes all components', () => {
    const form = Form.make([
      TextInput.make('name').label('Name'),
      TextInput.make('email').email(),
    ])
    const schema = form.toSchema()
    const components = schema.components as Record<string, unknown>[]
    expect(components).toHaveLength(2)
    expect(components[0].name).toBe('name')
    expect(components[1].name).toBe('email')
  })

  it('sets columns', () => {
    const schema = Form.make([TextInput.make('a')]).columns(2).toSchema()
    expect(schema.columns).toBe(2)
  })

  it('handles empty components', () => {
    const schema = Form.make([]).toSchema()
    const components = schema.components as unknown[]
    expect(components).toHaveLength(0)
  })

  it('serializes nested components with their extra schema', () => {
    const form = Form.make([
      TextInput.make('price').prefix('$').numeric(),
      Select.make('status').options({ active: 'Active', inactive: 'Inactive' }),
      Textarea.make('notes').rows(4),
    ])
    const schema = form.toSchema()
    const components = schema.components as Record<string, unknown>[]

    expect(components[0].prefix).toBe('$')
    expect(components[0].inputType).toBe('number')
    expect(components[1].options).toEqual({ active: 'Active', inactive: 'Inactive' })
    expect(components[2].rows).toBe(4)
  })
})
