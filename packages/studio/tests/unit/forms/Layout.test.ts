// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { Section } from '../../../src/forms/layout/Section.ts'
import { Tabs, Tab } from '../../../src/forms/layout/Tabs.ts'
import { Grid } from '../../../src/forms/layout/Grid.ts'
import { Wizard, WizardStep } from '../../../src/forms/layout/Wizard.ts'
import { Card } from '../../../src/forms/layout/Card.ts'
import { Fieldset } from '../../../src/forms/layout/Fieldset.ts'
import { TextInput } from '../../../src/forms/components/TextInput.ts'

describe('Section', () => {
  it('creates via static make', () => {
    const schema = Section.make().toSchema()
    expect(schema.type).toBe('section')
  })

  it('sets heading', () => {
    const schema = Section.make().heading('Personal Info').toSchema()
    expect(schema.heading).toBe('Personal Info')
  })

  it('sets description', () => {
    const schema = Section.make().description('Enter your personal details').toSchema()
    expect(schema.description).toBe('Enter your personal details')
  })

  it('sets schema with form components', () => {
    const schema = Section.make()
      .schema([
        TextInput.make('first_name'),
        TextInput.make('last_name'),
      ])
      .toSchema()

    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(2)
    expect(inner[0].name).toBe('first_name')
    expect(inner[1].name).toBe('last_name')
  })

  it('enables collapsible', () => {
    const schema = Section.make().collapsible().toSchema()
    expect(schema.collapsible).toBe(true)
  })

  it('defaults collapsible to false', () => {
    const schema = Section.make().toSchema()
    expect(schema.collapsible).toBe(false)
  })

  it('sets collapsed', () => {
    const schema = Section.make().collapsible().collapsed().toSchema()
    expect(schema.collapsed).toBe(true)
  })

  it('enables aside layout', () => {
    const schema = Section.make().aside().toSchema()
    expect(schema.aside).toBe(true)
  })

  it('sets icon', () => {
    const schema = Section.make().icon('user').toSchema()
    expect(schema.icon).toBe('user')
  })

  it('chains all methods', () => {
    const schema = Section.make()
      .heading('Contact')
      .description('Your contact details')
      .icon('phone')
      .collapsible()
      .collapsed()
      .aside()
      .schema([TextInput.make('phone')])
      .toSchema()

    expect(schema.heading).toBe('Contact')
    expect(schema.description).toBe('Your contact details')
    expect(schema.icon).toBe('phone')
    expect(schema.collapsible).toBe(true)
    expect(schema.collapsed).toBe(true)
    expect(schema.aside).toBe(true)
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(1)
  })
})

describe('Tab', () => {
  it('creates via static make', () => {
    const schema = Tab.make('General').toSchema()
    expect(schema.label).toBe('General')
  })

  it('sets icon', () => {
    const schema = Tab.make('Settings').icon('cog').toSchema()
    expect(schema.icon).toBe('cog')
  })

  it('sets badge', () => {
    const schema = Tab.make('Notifications').badge('3').toSchema()
    expect(schema.badge).toBe('3')
  })

  it('sets schema', () => {
    const schema = Tab.make('Details')
      .schema([TextInput.make('name')])
      .toSchema()
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(1)
    expect(inner[0].name).toBe('name')
  })
})

describe('Tabs', () => {
  it('creates via static make', () => {
    const schema = Tabs.make().toSchema()
    expect(schema.type).toBe('tabs')
  })

  it('sets tabs', () => {
    const schema = Tabs.make()
      .tabs([
        Tab.make('General').schema([TextInput.make('name')]),
        Tab.make('Details').schema([TextInput.make('email')]),
      ])
      .toSchema()

    const tabs = schema.tabs as Record<string, unknown>[]
    expect(tabs).toHaveLength(2)
    expect(tabs[0].label).toBe('General')
    expect(tabs[1].label).toBe('Details')
  })

  it('serializes nested tab schemas', () => {
    const schema = Tabs.make()
      .tabs([
        Tab.make('Info').schema([
          TextInput.make('username').required(),
        ]),
      ])
      .toSchema()

    const tabs = schema.tabs as Record<string, unknown>[]
    const tabSchema = tabs[0].schema as Record<string, unknown>[]
    expect(tabSchema[0].name).toBe('username')
    expect(tabSchema[0].required).toBe(true)
  })
})

describe('Grid', () => {
  it('creates via static make', () => {
    const schema = Grid.make().toSchema()
    expect(schema.type).toBe('grid')
  })

  it('defaults to 2 columns', () => {
    const schema = Grid.make().toSchema()
    expect(schema.columns).toBe(2)
  })

  it('sets columns', () => {
    const schema = Grid.make().columns(3).toSchema()
    expect(schema.columns).toBe(3)
  })

  it('sets schema', () => {
    const schema = Grid.make()
      .schema([TextInput.make('a'), TextInput.make('b')])
      .toSchema()

    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(2)
  })
})

describe('WizardStep', () => {
  it('creates via static make', () => {
    const schema = WizardStep.make('Step 1').toSchema()
    expect(schema.label).toBe('Step 1')
  })

  it('sets description', () => {
    const schema = WizardStep.make('Step 1').description('First step').toSchema()
    expect(schema.description).toBe('First step')
  })

  it('sets icon', () => {
    const schema = WizardStep.make('Step 1').icon('user').toSchema()
    expect(schema.icon).toBe('user')
  })

  it('sets schema', () => {
    const schema = WizardStep.make('Step 1')
      .schema([TextInput.make('name')])
      .toSchema()
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(1)
  })
})

describe('Wizard', () => {
  it('creates via static make', () => {
    const schema = Wizard.make().toSchema()
    expect(schema.type).toBe('wizard')
  })

  it('sets steps', () => {
    const schema = Wizard.make()
      .steps([
        WizardStep.make('Personal'),
        WizardStep.make('Account'),
        WizardStep.make('Review'),
      ])
      .toSchema()

    const steps = schema.steps as Record<string, unknown>[]
    expect(steps).toHaveLength(3)
    expect(steps[0].label).toBe('Personal')
    expect(steps[1].label).toBe('Account')
    expect(steps[2].label).toBe('Review')
  })

  it('serializes nested step schemas', () => {
    const schema = Wizard.make()
      .steps([
        WizardStep.make('Info')
          .description('Fill in your info')
          .icon('user')
          .schema([TextInput.make('name').required()]),
      ])
      .toSchema()

    const steps = schema.steps as Record<string, unknown>[]
    expect(steps[0].description).toBe('Fill in your info')
    expect(steps[0].icon).toBe('user')
    const stepSchema = steps[0].schema as Record<string, unknown>[]
    expect(stepSchema[0].required).toBe(true)
  })
})

describe('Card', () => {
  it('creates via static make', () => {
    const schema = Card.make().toSchema()
    expect(schema.type).toBe('card')
  })

  it('sets heading', () => {
    const schema = Card.make().heading('Profile').toSchema()
    expect(schema.heading).toBe('Profile')
  })

  it('sets description', () => {
    const schema = Card.make().description('Profile info').toSchema()
    expect(schema.description).toBe('Profile info')
  })

  it('sets schema', () => {
    const schema = Card.make()
      .schema([TextInput.make('field')])
      .toSchema()
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(1)
  })

  it('chains all methods', () => {
    const schema = Card.make()
      .heading('Card Title')
      .description('Card desc')
      .schema([TextInput.make('a'), TextInput.make('b')])
      .toSchema()

    expect(schema.heading).toBe('Card Title')
    expect(schema.description).toBe('Card desc')
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(2)
  })
})

describe('Fieldset', () => {
  it('creates via static make', () => {
    const schema = Fieldset.make().toSchema()
    expect(schema.type).toBe('fieldset')
  })

  it('sets legend', () => {
    const schema = Fieldset.make().legend('Address').toSchema()
    expect(schema.legend).toBe('Address')
  })

  it('sets schema', () => {
    const schema = Fieldset.make()
      .schema([TextInput.make('street'), TextInput.make('city')])
      .toSchema()
    const inner = schema.schema as Record<string, unknown>[]
    expect(inner).toHaveLength(2)
    expect(inner[0].name).toBe('street')
    expect(inner[1].name).toBe('city')
  })
})
