#!/usr/bin/env bun
/**
 * Studio Playground — renders schemas in a browser.
 * Run: bun packages/studio/tests/playground.ts
 * Opens http://localhost:4200 with a live preview of all Studio components.
 */
import { Resource } from '../src/resources/Resource.ts'
import { Form } from '../src/forms/Form.ts'
import { Table } from '../src/tables/Table.ts'
import { TextInput } from '../src/forms/components/TextInput.ts'
import { Textarea } from '../src/forms/components/Textarea.ts'
import { Select } from '../src/forms/components/Select.ts'
import { Toggle } from '../src/forms/components/Toggle.ts'
import { Checkbox } from '../src/forms/components/Checkbox.ts'
import { Radio } from '../src/forms/components/Radio.ts'
import { DatePicker } from '../src/forms/components/DatePicker.ts'
import { ColorPicker } from '../src/forms/components/ColorPicker.ts'
import { TagsInput } from '../src/forms/components/TagsInput.ts'
import { FileUpload } from '../src/forms/components/FileUpload.ts'
import { Repeater } from '../src/forms/components/Repeater.ts'
import { KeyValue } from '../src/forms/components/KeyValue.ts'
import { Section } from '../src/forms/layout/Section.ts'
import { Tabs, Tab } from '../src/forms/layout/Tabs.ts'
import { Grid } from '../src/forms/layout/Grid.ts'
import { TextColumn } from '../src/tables/columns/TextColumn.ts'
import { BadgeColumn } from '../src/tables/columns/BadgeColumn.ts'
import { BooleanColumn } from '../src/tables/columns/BooleanColumn.ts'
import { ImageColumn } from '../src/tables/columns/ImageColumn.ts'
import { SelectFilter } from '../src/tables/filters/SelectFilter.ts'
import { TernaryFilter } from '../src/tables/filters/TernaryFilter.ts'
import { DeleteAction } from '../src/actions/DeleteAction.ts'
import { EditAction } from '../src/actions/EditAction.ts'
import { ViewAction } from '../src/actions/ViewAction.ts'
import { BulkDeleteAction } from '../src/actions/BulkDeleteAction.ts'
import { StatsWidget, Stat } from '../src/widgets/StatsWidget.ts'
import { NavigationBuilder } from '../src/navigation/NavigationBuilder.ts'

// ── Sample Resources ─────────────────────────────────────────────────────────

class UserResource extends Resource {
  static override navigationIcon = 'users'
  static override navigationGroup = 'User Management'
  static override recordTitleAttribute = 'name'

  override form(): Form {
    return Form.make([
      Section.make('basic')
        .heading('Basic Information')
        .description('Core profile details.')
        .icon('user')
        .schema([
          TextInput.make('name').label('Full Name').required().placeholder('John Doe'),
          TextInput.make('email').email().required().placeholder('john@example.com'),
        ]),
      Tabs.make('details').tabs([
        Tab.make('Account').icon('shield').schema([
          TextInput.make('password').password().required().minLength(8).helperText('Min 8 characters'),
          Select.make('role').options({ admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' }).required().searchable(),
          Toggle.make('active').label('Active').helperText('Disable to suspend account'),
        ]),
        Tab.make('Profile').icon('user').schema([
          Textarea.make('bio').rows(3).placeholder('About yourself...'),
          ColorPicker.make('theme_color').label('Theme Color'),
          TagsInput.make('skills').label('Skills').suggestions(['TypeScript', 'React', 'Bun', 'SQL']),
        ]),
        Tab.make('Preferences').icon('settings').schema([
          Select.make('timezone').options({ 'UTC': 'UTC', 'US/Eastern': 'Eastern', 'US/Pacific': 'Pacific' }).default('UTC'),
          Radio.make('notifications').label('Email Notifications').options({ all: 'All', important: 'Important only', none: 'None' }),
          Checkbox.make('newsletter').label('Subscribe to newsletter'),
        ]),
      ]),
      Grid.make('dates').columns(2).schema([
        DatePicker.make('verified_at').label('Verified At').withTime().disabled(),
        DatePicker.make('created_at').label('Created At').disabled(),
      ]),
      FileUpload.make('avatar').label('Profile Photo').accept('image/*').maxSize(2).imagePreview(),
      Repeater.make('addresses').label('Addresses').minItems(0).maxItems(3).collapsible().schema([
        TextInput.make('street').label('Street').required(),
        Grid.make('city_state').columns(2).schema([
          TextInput.make('city').label('City'),
          TextInput.make('state').label('State'),
        ]),
        TextInput.make('zip').label('ZIP Code'),
      ]),
      KeyValue.make('metadata').label('Custom Metadata').addActionLabel('Add field'),
    ]).columns(1)
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      ImageColumn.make('avatar').circular().size(32),
      TextColumn.make('name').searchable().sortable(),
      TextColumn.make('email').searchable().sortable().copyable(),
      BadgeColumn.make('role').colors({ admin: 'danger', editor: 'warning', viewer: 'info' }).sortable(),
      BooleanColumn.make('active').trueIcon('check-circle').falseIcon('x-circle').trueColor('success').falseColor('muted'),
      TextColumn.make('created_at').label('Joined').dateTime().sortable(),
    ])
    .filters([
      SelectFilter.make('role').label('Role').options({ admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }).multiple(),
      TernaryFilter.make('active').label('Active').trueLabel('Active').falseLabel('Inactive'),
    ])
    .actions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('created_at', 'desc')
    .paginationPageOptions([10, 25, 50])
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
      Select.make('status').options({ pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }),
      TextInput.make('total').numeric().prefix('$'),
      Textarea.make('notes').rows(3),
    ])
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('order_number').sortable().searchable(),
      BadgeColumn.make('status').colors({ pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'danger' }),
      TextColumn.make('total').money('USD').sortable(),
      TextColumn.make('created_at').dateTime().sortable(),
    ])
    .actions([ViewAction.make(), EditAction.make()])
    .defaultSort('created_at', 'desc')
  }
}

// ── Build schemas ────────────────────────────────────────────────────────────

const userResource = new UserResource()
const orderResource = new OrderResource()

const schemas = {
  panel: {
    brandName: 'Mantiq Studio',
    darkMode: true,
    navigation: NavigationBuilder.buildFromResources([UserResource, OrderResource]),
    user: { name: 'Abdullah Khan', email: 'admin@mantiq.dev', avatar: null },
  },
  resources: {
    users: {
      ...userResource.toSchema(),
      data: {
        items: [
          { id: 1, name: 'Abdullah Khan', email: 'abdullah@mantiq.dev', role: 'admin', active: true, avatar: null, created_at: '2024-01-15T10:30:00Z' },
          { id: 2, name: 'Sarah Chen', email: 'sarah@example.com', role: 'editor', active: true, avatar: null, created_at: '2024-03-20T14:15:00Z' },
          { id: 3, name: 'James Wilson', email: 'james@example.com', role: 'viewer', active: false, avatar: null, created_at: '2024-05-10T09:00:00Z' },
          { id: 4, name: 'Maria Garcia', email: 'maria@example.com', role: 'editor', active: true, avatar: null, created_at: '2024-06-01T16:45:00Z' },
          { id: 5, name: 'Alex Johnson', email: 'alex@example.com', role: 'viewer', active: true, avatar: null, created_at: '2024-07-22T11:20:00Z' },
        ],
        meta: { total: 5, currentPage: 1, perPage: 10, lastPage: 1, from: 1, to: 5 },
      },
    },
    orders: {
      ...orderResource.toSchema(),
      data: {
        items: [
          { id: 1, order_number: 'ORD-001', status: 'delivered', total: 299.99, created_at: '2024-08-01T10:00:00Z' },
          { id: 2, order_number: 'ORD-002', status: 'shipped', total: 149.50, created_at: '2024-08-05T14:30:00Z' },
          { id: 3, order_number: 'ORD-003', status: 'pending', total: 599.00, created_at: '2024-08-10T09:15:00Z' },
          { id: 4, order_number: 'ORD-004', status: 'processing', total: 89.99, created_at: '2024-08-12T16:00:00Z' },
          { id: 5, order_number: 'ORD-005', status: 'cancelled', total: 199.00, created_at: '2024-08-15T11:45:00Z' },
        ],
        meta: { total: 5, currentPage: 1, perPage: 10, lastPage: 1, from: 1, to: 5 },
      },
    },
  },
  widgets: {
    stats: StatsWidget.make().stats([
      Stat.make('Total Users', '12,345').description('+12% from last month').descriptionIcon('trending-up').color('primary').chart([4, 6, 8, 5, 9, 12, 15]).trend('up'),
      Stat.make('Revenue', '$89,432').description('+8.2%').color('success').chart([10, 12, 8, 15, 18, 20, 22]).trend('up'),
      Stat.make('Orders', '856').description('+3.1%').color('info').chart([20, 18, 22, 25, 20, 28, 30]).trend('up'),
      Stat.make('Churn', '2.4%').description('-0.3%').color('danger').chart([5, 4, 6, 3, 4, 3, 2]).trend('down'),
    ]).toSchema(),
  },
}

// ── HTML template ────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mantiq Studio — Playground</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:{50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a'}}}}}<\/script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lucide-static@latest/font/lucide.min.css">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
  .sidebar { width: 260px; }
  .badge-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .badge-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .badge-info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
  .badge-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .badge-primary { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
  .badge-muted { background: #f4f4f5; color: #71717a; border: 1px solid #e4e4e7; }
  .sparkline { display: inline-block; }
  pre { font-size: 11px; line-height: 1.4; }
  .tab-active { border-bottom: 2px solid #2563eb; color: #2563eb; font-weight: 600; }
  .tab-inactive { border-bottom: 2px solid transparent; color: #71717a; }
  .tab-inactive:hover { color: #18181b; }
</style>
</head>
<body class="bg-gray-50 text-gray-900">

<div class="flex min-h-screen">
  <!-- Sidebar -->
  <aside class="sidebar bg-white border-r border-gray-200 flex flex-col">
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-xs font-bold">M</div>
        <div>
          <div class="text-sm font-semibold" id="brand-name"></div>
          <div class="text-xs text-gray-500">Studio</div>
        </div>
      </div>
    </div>
    <nav class="flex-1 p-3 space-y-4" id="sidebar-nav"></nav>
    <div class="p-3 border-t border-gray-200">
      <div class="flex items-center gap-2 px-2 py-1.5">
        <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium" id="user-avatar"></div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate" id="user-name"></div>
          <div class="text-xs text-gray-500 truncate" id="user-email"></div>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-auto">
    <!-- Header tabs -->
    <div class="bg-white border-b border-gray-200 px-6">
      <div class="flex gap-6">
        <button class="py-3 text-sm tab-active" onclick="showView('table')">Table View</button>
        <button class="py-3 text-sm tab-inactive" onclick="showView('form')">Form View</button>
        <button class="py-3 text-sm tab-inactive" onclick="showView('schema')">Raw Schema</button>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Widgets -->
      <div id="widgets-container" class="grid grid-cols-4 gap-4"></div>

      <!-- Content area -->
      <div id="table-view"></div>
      <div id="form-view" class="hidden"></div>
      <div id="schema-view" class="hidden"></div>
    </div>
  </main>
</div>

<script>
const schemas = ${JSON.stringify(schemas, null, 2)};
let activeResource = 'users';
let activeView = 'table';

// ── Render sidebar ──────────────────────────────────────────────
function renderSidebar() {
  document.getElementById('brand-name').textContent = schemas.panel.brandName;
  document.getElementById('user-name').textContent = schemas.panel.user.name;
  document.getElementById('user-email').textContent = schemas.panel.user.email;
  document.getElementById('user-avatar').textContent = schemas.panel.user.name.split(' ').map(n => n[0]).join('');

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = schemas.panel.navigation.map(group => \`
    <div>
      <div class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">\${group.label}</div>
      <div class="space-y-0.5">
        \${group.items.map(item => \`
          <button onclick="switchResource('\${item.url.split('/').pop()}')"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors \${activeResource === item.url.split('/').pop() ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}">
            <i class="lucide lucide-\${item.icon} w-4 h-4"></i>
            \${item.label}
          </button>
        \`).join('')}
      </div>
    </div>
  \`).join('');
}

// ── Render widgets ──────────────────────────────────────────────
function renderWidgets() {
  const container = document.getElementById('widgets-container');
  const stats = schemas.widgets.stats.stats;
  container.innerHTML = stats.map(stat => {
    const trendColor = stat.trend?.direction === 'up' ? 'text-emerald-600' : 'text-red-600';
    const trendIcon = stat.trend?.direction === 'up' ? '↑' : '↓';
    const sparklineSvg = stat.chart?.length ? renderSparkline(stat.chart, stat.color) : '';
    return \`
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">\${stat.label}</span>
          \${sparklineSvg}
        </div>
        <div class="mt-1 text-2xl font-bold">\${stat.value}</div>
        <div class="mt-1 flex items-center gap-1 text-xs \${trendColor}">
          <span>\${trendIcon}</span>
          <span>\${stat.description || ''}</span>
        </div>
      </div>
    \`;
  }).join('');
}

function renderSparkline(data, color) {
  const w = 60, h = 24;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => \`\${(i / (data.length - 1)) * w},\${h - ((v - min) / range) * h}\`).join(' ');
  const colors = { primary: '#3b82f6', success: '#16a34a', info: '#2563eb', danger: '#dc2626' };
  const c = colors[color] || '#3b82f6';
  return \`<svg width="\${w}" height="\${h}" class="sparkline"><polyline points="\${points}" fill="none" stroke="\${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\`;
}

// ── Render table ────────────────────────────────────────────────
function renderTable() {
  const r = schemas.resources[activeResource];
  const table = r.table;
  const data = r.data;

  let html = \`
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold capitalize">\${activeResource}</h2>
        <div class="flex items-center gap-2">
          \${table.searchable ? '<input type="text" placeholder="Search..." class="h-8 px-3 text-sm border border-gray-200 rounded-md w-48">' : ''}
          \${table.filters.map(f => \`
            <select class="h-8 px-2 text-sm border border-gray-200 rounded-md">
              <option>\${f.label || f.name}</option>
              \${f.options ? Object.entries(f.options).map(([k,v]) => \`<option value="\${k}">\${v}</option>\`).join('') : ''}
            </select>
          \`).join('')}
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50/50">
            <th class="w-10 px-4 py-2"><input type="checkbox" class="rounded"></th>
            \${table.columns.filter(c => !c.hidden).map(col => \`
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" \${col.width ? \`style="width:\${col.width}"\` : ''}>
                \${col.label || col.name}
                \${col.sortable ? '<span class="text-gray-300 ml-1">↕</span>' : ''}
              </th>
            \`).join('')}
            <th class="w-20 px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          \${data.items.map((row, idx) => \`
            <tr class="hover:bg-gray-50 \${table.striped && idx % 2 ? 'bg-gray-50/30' : ''}">
              <td class="px-4 py-2.5"><input type="checkbox" class="rounded"></td>
              \${table.columns.filter(c => !c.hidden).map(col => \`
                <td class="px-4 py-2.5 text-sm">\${renderCell(col, row[col.name], row)}</td>
              \`).join('')}
              <td class="px-4 py-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  \${table.actions.map(a => \`
                    <button class="p-1 rounded hover:bg-gray-100" title="\${a.label}">
                      <i class="lucide lucide-\${a.icon} w-3.5 h-3.5 text-gray-400"></i>
                    </button>
                  \`).join('')}
                </div>
              </td>
            </tr>
          \`).join('')}
        </tbody>
      </table>
      <div class="p-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
        <span>Showing \${data.meta.from}-\${data.meta.to} of \${data.meta.total}</span>
        <div class="flex items-center gap-1">
          <button class="px-2 py-1 rounded border border-gray-200 text-xs">Previous</button>
          <button class="px-2 py-1 rounded bg-primary-600 text-white text-xs">1</button>
          <button class="px-2 py-1 rounded border border-gray-200 text-xs">Next</button>
        </div>
      </div>
    </div>
  \`;
  document.getElementById('table-view').innerHTML = html;
}

function renderCell(col, value, row) {
  if (value === null || value === undefined) return '<span class="text-gray-300">—</span>';
  switch (col.type) {
    case 'badge': {
      const color = col.colors?.[value] || 'muted';
      return \`<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium badge-\${color}">\${value}</span>\`;
    }
    case 'boolean':
      return value
        ? \`<i class="lucide lucide-\${col.trueIcon || 'check'} w-4 h-4" style="color: \${col.trueColor === 'success' ? '#16a34a' : '#3b82f6'}"></i>\`
        : \`<i class="lucide lucide-\${col.falseIcon || 'x'} w-4 h-4" style="color: \${col.falseColor === 'muted' ? '#a1a1aa' : '#dc2626'}"></i>\`;
    case 'image':
      return value
        ? \`<img src="\${value}" class="\${col.circular ? 'rounded-full' : 'rounded'}" style="width:\${col.size || 32}px;height:\${col.size || 32}px;object-fit:cover">\`
        : \`<div class="\${col.circular ? 'rounded-full' : 'rounded'} bg-gray-200" style="width:\${col.size || 32}px;height:\${col.size || 32}px"></div>\`;
    case 'text':
      if (col.dateTime || col.date) return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(col.dateTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
      if (col.money) return typeof value === 'number' ? '$' + value.toFixed(2) : value;
      if (col.copyable) return \`<span class="group cursor-pointer">\${col.limit ? String(value).slice(0, col.limit) : value} <i class="lucide lucide-copy w-3 h-3 text-gray-300 group-hover:text-gray-500 inline"></i></span>\`;
      return col.limit ? String(value).slice(0, col.limit) : value;
    default:
      return String(value);
  }
}

// ── Render form ─────────────────────────────────────────────────
function renderForm() {
  const r = schemas.resources[activeResource];
  const form = r.form;

  document.getElementById('form-view').innerHTML = \`
    <div class="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
      <h2 class="text-lg font-semibold mb-6 capitalize">Create \${activeResource.slice(0, -1)}</h2>
      <div class="space-y-6" style="column-count: \${form.columns > 1 ? form.columns : 1}">
        \${form.components.map(c => renderFormComponent(c)).join('')}
      </div>
      <div class="mt-6 flex gap-3 pt-4 border-t border-gray-200">
        <button class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Create</button>
        <button class="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  \`;
}

function renderFormComponent(c) {
  switch (c.type) {
    case 'section':
      return \`
        <div class="rounded-lg border border-gray-200 p-4 mb-4 break-inside-avoid">
          <div class="mb-3">
            <h3 class="text-sm font-semibold">\${c.heading || ''}</h3>
            \${c.description ? \`<p class="text-xs text-gray-500 mt-0.5">\${c.description}</p>\` : ''}
          </div>
          <div class="space-y-4">\${(c.schema || []).map(s => renderFormComponent(s)).join('')}</div>
        </div>
      \`;
    case 'tabs':
      return \`
        <div class="mb-4 break-inside-avoid">
          <div class="flex gap-4 border-b border-gray-200 mb-4">
            \${c.tabs.map((t, i) => \`<button class="pb-2 text-sm \${i === 0 ? 'tab-active' : 'tab-inactive'}">\${t.label}</button>\`).join('')}
          </div>
          <div class="space-y-4">\${c.tabs[0]?.schema?.map(s => renderFormComponent(s)).join('') || ''}</div>
        </div>
      \`;
    case 'grid':
      return \`
        <div class="grid gap-4 mb-2 break-inside-avoid" style="grid-template-columns: repeat(\${c.columns || 2}, 1fr)">
          \${(c.schema || []).map(s => renderFormComponent(s)).join('')}
        </div>
      \`;
    case 'text-input':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}\${c.required ? ' <span class="text-red-500">*</span>' : ''}</label>
          <div class="relative">
            \${c.prefix ? \`<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">\${c.prefix}</span>\` : ''}
            <input type="\${c.inputType || 'text'}" placeholder="\${c.placeholder || ''}" \${c.disabled ? 'disabled' : ''}
              class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg \${c.disabled ? 'bg-gray-50 text-gray-400' : ''} \${c.prefix ? 'pl-7' : ''}">
          </div>
          \${c.helperText ? \`<p class="text-xs text-gray-400 mt-1">\${c.helperText}</p>\` : ''}
        </div>
      \`;
    case 'textarea':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}</label>
          <textarea rows="\${c.rows || 3}" placeholder="\${c.placeholder || ''}" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"></textarea>
        </div>
      \`;
    case 'select':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}\${c.required ? ' <span class="text-red-500">*</span>' : ''}</label>
          <select class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Select...</option>
            \${c.options ? Object.entries(c.options).map(([k,v]) => \`<option value="\${k}">\${v}</option>\`).join('') : ''}
          </select>
        </div>
      \`;
    case 'toggle':
      return \`
        <div class="flex items-center justify-between py-1 break-inside-avoid">
          <div>
            <label class="text-sm font-medium text-gray-700">\${c.label || c.name}</label>
            \${c.helperText ? \`<p class="text-xs text-gray-400">\${c.helperText}</p>\` : ''}
          </div>
          <button class="w-9 h-5 rounded-full bg-gray-200 relative transition-colors">
            <span class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"></span>
          </button>
        </div>
      \`;
    case 'checkbox':
      return \`
        <div class="flex items-center gap-2 break-inside-avoid">
          <input type="checkbox" class="rounded border-gray-300">
          <label class="text-sm text-gray-700">\${c.label || c.name}</label>
        </div>
      \`;
    case 'radio':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-2">\${c.label || c.name}</label>
          <div class="space-y-2">
            \${c.options ? Object.entries(c.options).map(([k,v]) => \`
              <label class="flex items-center gap-2 text-sm"><input type="radio" name="\${c.name}" value="\${k}" class="border-gray-300"> \${v}</label>
            \`).join('') : ''}
          </div>
        </div>
      \`;
    case 'date-picker':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}</label>
          <input type="\${c.withTime ? 'datetime-local' : 'date'}" \${c.disabled ? 'disabled' : ''} class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg \${c.disabled ? 'bg-gray-50 text-gray-400' : ''}">
        </div>
      \`;
    case 'color-picker':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}</label>
          <input type="color" class="w-full h-9 rounded-lg border border-gray-200 cursor-pointer">
        </div>
      \`;
    case 'tags-input':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}</label>
          <div class="flex flex-wrap gap-1 p-2 border border-gray-200 rounded-lg min-h-[36px]">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs">TypeScript <button class="hover:text-red-500">×</button></span>
            <input type="text" placeholder="Add tag..." class="flex-1 min-w-[80px] text-sm outline-none">
          </div>
        </div>
      \`;
    case 'file-upload':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-1">\${c.label || c.name}</label>
          <div class="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-primary-300 transition-colors cursor-pointer">
            <i class="lucide lucide-upload w-6 h-6 text-gray-400 mx-auto mb-2"></i>
            <p class="text-sm text-gray-500">Click or drag to upload</p>
            \${c.maxSize ? \`<p class="text-xs text-gray-400 mt-1">Max \${c.maxSize}MB</p>\` : ''}
          </div>
        </div>
      \`;
    case 'repeater':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-2">\${c.label || c.name}</label>
          <div class="space-y-2">
            <div class="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-gray-500">Item 1</span>
                <button class="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
              <div class="space-y-3">\${(c.schema || []).map(s => renderFormComponent(s)).join('')}</div>
            </div>
            <button class="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600">
              + \${c.addActionLabel || 'Add item'}
            </button>
          </div>
        </div>
      \`;
    case 'key-value':
      return \`
        <div class="break-inside-avoid">
          <label class="block text-sm font-medium text-gray-700 mb-2">\${c.label || c.name}</label>
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="grid grid-cols-2 gap-px bg-gray-200">
              <div class="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">\${c.keyLabel || 'Key'}</div>
              <div class="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">\${c.valueLabel || 'Value'}</div>
              <input class="bg-white px-3 py-1.5 text-sm outline-none" placeholder="key">
              <input class="bg-white px-3 py-1.5 text-sm outline-none" placeholder="value">
            </div>
          </div>
          <button class="mt-1 text-xs text-primary-600 hover:text-primary-700">+ \${c.addActionLabel || 'Add row'}</button>
        </div>
      \`;
    default:
      return \`<div class="text-xs text-gray-400 p-2 border border-dashed border-gray-200 rounded break-inside-avoid">\${c.type}: \${c.name || 'unknown'}</div>\`;
  }
}

// ── View switching ──────────────────────────────────────────────
function showView(view) {
  activeView = view;
  document.querySelectorAll('main .flex.gap-6 button').forEach((btn, i) => {
    btn.className = 'py-3 text-sm ' + (['table','form','schema'][i] === view ? 'tab-active' : 'tab-inactive');
  });
  document.getElementById('table-view').classList.toggle('hidden', view !== 'table');
  document.getElementById('form-view').classList.toggle('hidden', view !== 'form');
  document.getElementById('schema-view').classList.toggle('hidden', view !== 'schema');
  if (view === 'table') renderTable();
  if (view === 'form') renderForm();
  if (view === 'schema') {
    document.getElementById('schema-view').innerHTML = \`
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <pre class="overflow-auto max-h-[80vh] text-gray-700">\${JSON.stringify(schemas.resources[activeResource], null, 2)}</pre>
      </div>
    \`;
  }
}

function switchResource(name) {
  activeResource = name;
  renderSidebar();
  showView(activeView);
}

// ── Init ────────────────────────────────────────────────────────
renderSidebar();
renderWidgets();
renderTable();
</script>
</body>
</html>`;

// ── Start server ─────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: 4200,
  fetch() {
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  },
})

console.log(`\n  \x1b[32m●\x1b[0m  \x1b[1mMantiq Studio Playground\x1b[0m`)
console.log(`     http://localhost:${server.port}\n`)
console.log(`  \x1b[2mResources: Users, Orders`)
console.log(`  Views: Table, Form, Raw Schema`)
console.log(`  Press Ctrl+C to stop\x1b[0m\n`)
