#!/usr/bin/env bun
/**
 * Smoke test — run with: bun packages/studio/tests/smoke.ts
 * Outputs the full JSON schema for a sample Resource so you can inspect it.
 */
import { Resource } from '../src/resources/Resource.ts'
import { Form } from '../src/forms/Form.ts'
import { Table } from '../src/tables/Table.ts'
import { TextInput } from '../src/forms/components/TextInput.ts'
import { Textarea } from '../src/forms/components/Textarea.ts'
import { Select } from '../src/forms/components/Select.ts'
import { Toggle } from '../src/forms/components/Toggle.ts'
import { DatePicker } from '../src/forms/components/DatePicker.ts'
import { Section } from '../src/forms/layout/Section.ts'
import { Tabs, Tab } from '../src/forms/layout/Tabs.ts'
import { TextColumn } from '../src/tables/columns/TextColumn.ts'
import { BadgeColumn } from '../src/tables/columns/BadgeColumn.ts'
import { BooleanColumn } from '../src/tables/columns/BooleanColumn.ts'
import { SelectFilter } from '../src/tables/filters/SelectFilter.ts'
import { TernaryFilter } from '../src/tables/filters/TernaryFilter.ts'
import { DeleteAction } from '../src/actions/DeleteAction.ts'
import { EditAction } from '../src/actions/EditAction.ts'
import { BulkDeleteAction } from '../src/actions/BulkDeleteAction.ts'
import { StatsWidget, Stat } from '../src/widgets/StatsWidget.ts'
import { NavigationBuilder } from '../src/navigation/NavigationBuilder.ts'

// ── Sample Resource ──────────────────────────────────────────────────────────

class UserResource extends Resource {
  static override navigationIcon = 'users'
  static override navigationGroup = 'User Management'
  static override recordTitleAttribute = 'name'
  static override globallySearchable = true

  override form(): Form {
    return Form.make([
      Section.make('basic')
        .heading('Basic Information')
        .description('The user\'s core profile details.')
        .schema([
          TextInput.make('name')
            .label('Full Name')
            .required()
            .maxLength(255)
            .placeholder('John Doe'),
          TextInput.make('email')
            .email()
            .required()
            .placeholder('john@example.com'),
        ]),

      Tabs.make('details')
        .tabs([
          Tab.make('Security')
            .icon('lock')
            .schema([
              TextInput.make('password')
                .password()
                .required()
                .minLength(8)
                .helperText('Must be at least 8 characters'),
              Toggle.make('two_factor')
                .label('Two-Factor Authentication')
                .helperText('Require 2FA on login'),
            ]),
          Tab.make('Preferences')
            .icon('settings')
            .schema([
              Select.make('role')
                .options({ admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' })
                .required()
                .searchable(),
              Select.make('timezone')
                .options({ 'UTC': 'UTC', 'US/Eastern': 'Eastern', 'US/Pacific': 'Pacific', 'Europe/London': 'London' })
                .searchable()
                .default('UTC'),
              Textarea.make('bio')
                .rows(4)
                .placeholder('Tell us about yourself...'),
            ]),
        ]),

      DatePicker.make('verified_at')
        .label('Email Verified At')
        .withTime()
        .disabled(),
    ]).columns(2)
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('id')
        .label('#')
        .sortable()
        .width('60px'),
      TextColumn.make('name')
        .searchable()
        .sortable()
        .limit(30),
      TextColumn.make('email')
        .searchable()
        .sortable()
        .copyable(),
      BadgeColumn.make('role')
        .colors({ admin: 'danger', editor: 'warning', viewer: 'info' })
        .sortable(),
      BooleanColumn.make('two_factor')
        .label('2FA')
        .trueIcon('shield-check')
        .falseIcon('shield-off')
        .trueColor('success')
        .falseColor('muted'),
      TextColumn.make('created_at')
        .label('Joined')
        .dateTime()
        .sortable(),
    ])
    .filters([
      SelectFilter.make('role')
        .label('Role')
        .options({ admin: 'Admin', editor: 'Editor', viewer: 'Viewer' })
        .multiple(),
      TernaryFilter.make('two_factor')
        .label('2FA Enabled')
        .trueLabel('Enabled')
        .falseLabel('Disabled'),
    ])
    .actions([
      EditAction.make(),
      DeleteAction.make(),
    ])
    .bulkActions([
      BulkDeleteAction.make(),
    ])
    .defaultSort('created_at', 'desc')
    .searchable()
    .paginated()
    .paginationPageOptions([10, 25, 50])
    .striped()
    .emptyStateHeading('No users found')
    .emptyStateDescription('Try adjusting your search or filters.')
    .emptyStateIcon('users')
  }
}

class OrderResource extends Resource {
  static override navigationIcon = 'shopping-cart'
  static override navigationGroup = 'Commerce'
  static override navigationSort = 1

  override form(): Form {
    return Form.make([
      TextInput.make('order_number').disabled(),
      Select.make('status').options({ pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' }),
      TextInput.make('total').numeric().prefix('$'),
    ])
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('order_number').sortable(),
      BadgeColumn.make('status').colors({ pending: 'warning', shipped: 'info', delivered: 'success' }),
      TextColumn.make('total').money('USD').sortable(),
    ])
  }
}

// ── Output ───────────────────────────────────────────────────────────────────

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const R = '\x1b[0m'

console.log(`\n${GREEN}${BOLD}@mantiq/studio${R} ${DIM}— Schema Smoke Test${R}\n`)

// Resource schemas
const userResource = new UserResource()
const orderResource = new OrderResource()

console.log(`${CYAN}${BOLD}1. UserResource.form().toSchema()${R}`)
console.log(JSON.stringify(userResource.form().toSchema(), null, 2))

console.log(`\n${CYAN}${BOLD}2. UserResource.table().toSchema()${R}`)
console.log(JSON.stringify(userResource.table().toSchema(), null, 2))

console.log(`\n${CYAN}${BOLD}3. UserResource.toSchema()${R}`)
console.log(JSON.stringify(userResource.toSchema(), null, 2))

// Navigation
console.log(`\n${CYAN}${BOLD}4. NavigationBuilder.buildFromResources()${R}`)
const nav = NavigationBuilder.buildFromResources([UserResource, OrderResource])
console.log(JSON.stringify(nav, null, 2))

// Stats widget
const stats = StatsWidget.make()
  .stats([
    Stat.make('Total Users', '12,345').description('+12% from last month').descriptionIcon('trending-up').color('primary').chart([4, 6, 8, 5, 9, 12, 15]).trend('up'),
    Stat.make('Revenue', '$89,432').description('+8.2% from last month').color('success').trend('up'),
    Stat.make('Churn Rate', '2.4%').description('-0.3% from last month').color('danger').trend('down'),
  ])
  .columnSpan('full')

console.log(`\n${CYAN}${BOLD}5. StatsWidget.toSchema()${R}`)
console.log(JSON.stringify(stats.toSchema(), null, 2))

// Summary
const formSchema = userResource.form().toSchema()
const tableSchema = userResource.table().toSchema()
console.log(`\n${GREEN}${BOLD}Summary${R}`)
console.log(`  Form components: ${formSchema.components.length} top-level (with nested fields in sections/tabs)`)
console.log(`  Table columns:   ${tableSchema.columns.length}`)
console.log(`  Table filters:   ${tableSchema.filters.length}`)
console.log(`  Table actions:   ${tableSchema.actions.length}`)
console.log(`  Bulk actions:    ${tableSchema.bulkActions.length}`)
console.log(`  Nav groups:      ${nav.length}`)
console.log(`  Nav items:       ${nav.reduce((sum: number, g: any) => sum + g.items.length, 0)}`)
console.log()
