#!/usr/bin/env bun
/**
 * Studio Playground with LIVE API — SQLite-backed, fully functional.
 * Run: bun packages/studio/tests/playground-api.ts
 * Opens http://localhost:4200 with working search, filters, sorting, pagination, CRUD.
 */
import { Database } from 'bun:sqlite'

// ── Setup SQLite ─────────────────────────────────────────────────────────────

const db = new Database(':memory:')

db.run(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer',
  active INTEGER NOT NULL DEFAULT 1,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

db.run(`CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

// Seed users
const insertUser = db.prepare('INSERT INTO users (name, email, role, active, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)')
const users = [
  ['Abdullah Khan', 'abdullah@mantiq.dev', 'admin', 1, 'Framework author', '2024-01-15 10:30:00'],
  ['Sarah Chen', 'sarah@example.com', 'editor', 1, 'Content lead', '2024-02-20 14:15:00'],
  ['James Wilson', 'james@example.com', 'viewer', 0, null, '2024-03-10 09:00:00'],
  ['Maria Garcia', 'maria@example.com', 'editor', 1, 'Designer', '2024-04-01 16:45:00'],
  ['Alex Johnson', 'alex@example.com', 'viewer', 1, null, '2024-05-22 11:20:00'],
  ['Emma Brown', 'emma@example.com', 'admin', 1, 'CTO', '2024-06-05 08:00:00'],
  ['Noah Davis', 'noah@example.com', 'editor', 1, null, '2024-06-18 13:30:00'],
  ['Olivia Martinez', 'olivia@example.com', 'viewer', 0, null, '2024-07-02 10:00:00'],
  ['Liam Taylor', 'liam@example.com', 'viewer', 1, 'Intern', '2024-07-15 09:00:00'],
  ['Sophia Anderson', 'sophia@example.com', 'editor', 1, null, '2024-08-01 14:00:00'],
  ['Ethan Thomas', 'ethan@example.com', 'viewer', 1, null, '2024-08-10 11:00:00'],
  ['Isabella Jackson', 'isabella@example.com', 'admin', 1, 'VP Eng', '2024-08-20 16:00:00'],
  ['Mason White', 'mason@example.com', 'viewer', 0, null, '2024-09-01 10:00:00'],
  ['Ava Harris', 'ava@example.com', 'editor', 1, null, '2024-09-12 15:00:00'],
  ['Lucas Martin', 'lucas@example.com', 'viewer', 1, null, '2024-09-25 12:00:00'],
]
for (const u of users) insertUser.run(...u)

const insertOrder = db.prepare('INSERT INTO orders (order_number, status, total, notes, created_at) VALUES (?, ?, ?, ?, ?)')
const orders = [
  ['ORD-001', 'delivered', 299.99, 'Express shipping', '2024-08-01 10:00:00'],
  ['ORD-002', 'shipped', 149.50, null, '2024-08-05 14:30:00'],
  ['ORD-003', 'pending', 599.00, 'Gift wrap requested', '2024-08-10 09:15:00'],
  ['ORD-004', 'processing', 89.99, null, '2024-08-12 16:00:00'],
  ['ORD-005', 'cancelled', 199.00, 'Customer cancelled', '2024-08-15 11:45:00'],
  ['ORD-006', 'delivered', 450.00, null, '2024-08-20 09:00:00'],
  ['ORD-007', 'shipped', 75.00, null, '2024-08-25 14:00:00'],
  ['ORD-008', 'pending', 320.00, 'Backordered', '2024-09-01 10:30:00'],
  ['ORD-009', 'delivered', 189.99, null, '2024-09-05 16:00:00'],
  ['ORD-010', 'processing', 1250.00, 'Bulk order', '2024-09-10 11:00:00'],
  ['ORD-011', 'pending', 67.50, null, '2024-09-15 13:00:00'],
  ['ORD-012', 'delivered', 445.00, null, '2024-09-20 08:00:00'],
]
for (const o of orders) insertOrder.run(...o)

// ── API handlers ─────────────────────────────────────────────────────────────

const resourceConfigs: Record<string, { table: string; searchColumns: string[]; filterColumns: string[] }> = {
  users: { table: 'users', searchColumns: ['name', 'email'], filterColumns: ['role', 'active'] },
  orders: { table: 'orders', searchColumns: ['order_number', 'notes'], filterColumns: ['status'] },
}

function handleList(resource: string, url: URL): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = parseInt(url.searchParams.get('perPage') || '10')
  const search = url.searchParams.get('search') || ''
  const sort = url.searchParams.get('sort') || 'id'
  const direction = url.searchParams.get('direction') || 'desc'

  let whereClause = '1=1'
  const params: any[] = []

  // Search
  if (search) {
    const searchClauses = config.searchColumns.map(col => `${col} LIKE ?`)
    whereClause += ` AND (${searchClauses.join(' OR ')})`
    for (const _ of config.searchColumns) params.push(`%${search}%`)
  }

  // Filters
  for (const col of config.filterColumns) {
    const val = url.searchParams.get(`filter[${col}]`)
    if (val !== null && val !== '') {
      if (col === 'active') {
        whereClause += ` AND active = ?`
        params.push(val === 'true' ? 1 : 0)
      } else {
        // Support comma-separated values for multi-select
        const values = val.split(',').filter(Boolean)
        if (values.length === 1) {
          whereClause += ` AND ${col} = ?`
          params.push(values[0])
        } else if (values.length > 1) {
          whereClause += ` AND ${col} IN (${values.map(() => '?').join(',')})`
          params.push(...values)
        }
      }
    }
  }

  // Validate sort column
  const allowedSorts = ['id', 'name', 'email', 'role', 'active', 'created_at', 'order_number', 'status', 'total']
  const safeSort = allowedSorts.includes(sort) ? sort : 'id'
  const safeDir = direction === 'asc' ? 'ASC' : 'DESC'

  // Count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM ${config.table} WHERE ${whereClause}`).get(...params) as any
  const total = countRow.total

  // Paginate
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const currentPage = Math.min(page, lastPage)
  const offset = (currentPage - 1) * perPage

  const rows = db.prepare(
    `SELECT * FROM ${config.table} WHERE ${whereClause} ORDER BY ${safeSort} ${safeDir} LIMIT ? OFFSET ?`
  ).all(...params, perPage, offset)

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)

  return Response.json({
    data: rows,
    meta: { total, currentPage, perPage, lastPage, from, to },
  })
}

function handleCreate(resource: string, body: any): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  if (resource === 'users') {
    if (!body.name || !body.email) {
      return Response.json({ errors: { name: !body.name ? ['Name is required'] : [], email: !body.email ? ['Email is required'] : [] } }, { status: 422 })
    }
    const result = db.prepare('INSERT INTO users (name, email, role, active, bio) VALUES (?, ?, ?, ?, ?)').run(
      body.name, body.email, body.role || 'viewer', body.active !== undefined ? (body.active ? 1 : 0) : 1, body.bio || null
    )
    const record = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
    return Response.json({ data: record, message: 'User created.' }, { status: 201 })
  }

  if (resource === 'orders') {
    const num = `ORD-${String(Date.now()).slice(-4)}`
    const result = db.prepare('INSERT INTO orders (order_number, status, total, notes) VALUES (?, ?, ?, ?)').run(
      num, body.status || 'pending', body.total || 0, body.notes || null
    )
    const record = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid)
    return Response.json({ data: record, message: 'Order created.' }, { status: 201 })
  }

  return Response.json({ error: 'Unknown resource' }, { status: 404 })
}

function handleShow(resource: string, id: string): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  const record = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!record) return Response.json({ error: 'Record not found' }, { status: 404 })
  return Response.json({ data: record })
}

function handleUpdate(resource: string, id: string, body: any): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!existing) return Response.json({ error: 'Record not found' }, { status: 404 })

  if (resource === 'users') {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, bio = ? WHERE id = ?').run(
      body.name ?? (existing as any).name, body.email ?? (existing as any).email, body.role ?? (existing as any).role,
      body.active !== undefined ? (body.active ? 1 : 0) : (existing as any).active, body.bio ?? (existing as any).bio, id
    )
  } else if (resource === 'orders') {
    db.prepare('UPDATE orders SET status = ?, total = ?, notes = ? WHERE id = ?').run(
      body.status ?? (existing as any).status, body.total ?? (existing as any).total, body.notes ?? (existing as any).notes, id
    )
  }

  const updated = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  return Response.json({ data: updated, message: 'Updated.' })
}

function handleDelete(resource: string, id: string): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!existing) return Response.json({ error: 'Record not found' }, { status: 404 })
  db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id)
  return Response.json({ message: 'Deleted.' })
}

function handleBulkDelete(resource: string, ids: number[]): Response {
  const config = resourceConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!ids.length) return Response.json({ error: 'No IDs provided' }, { status: 400 })
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM ${config.table} WHERE id IN (${placeholders})`).run(...ids)
  return Response.json({ message: `Deleted ${ids.length} record(s).` })
}

function handleStats(): Response {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
  const activeCount = (db.prepare('SELECT COUNT(*) as c FROM users WHERE active = 1').get() as any).c
  const orderCount = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c
  const revenue = (db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != ?').get('cancelled') as any).s
  return Response.json({ users: userCount, active: activeCount, orders: orderCount, revenue: revenue.toFixed(2) })
}

// ── Import schemas from playground ───────────────────────────────────────────

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
import { Grid } from '../src/forms/layout/Grid.ts'
import { TextColumn } from '../src/tables/columns/TextColumn.ts'
import { BadgeColumn } from '../src/tables/columns/BadgeColumn.ts'
import { BooleanColumn } from '../src/tables/columns/BooleanColumn.ts'
import { SelectFilter } from '../src/tables/filters/SelectFilter.ts'
import { TernaryFilter } from '../src/tables/filters/TernaryFilter.ts'
import { DeleteAction } from '../src/actions/DeleteAction.ts'
import { EditAction } from '../src/actions/EditAction.ts'
import { ViewAction } from '../src/actions/ViewAction.ts'
import { BulkDeleteAction } from '../src/actions/BulkDeleteAction.ts'
import { NavigationBuilder } from '../src/navigation/NavigationBuilder.ts'

class UserResource extends Resource {
  static override navigationIcon = 'users'
  static override navigationGroup = 'User Management'
  override form(): Form {
    return Form.make([
      Section.make('basic').heading('Basic Information').schema([
        TextInput.make('name').label('Full Name').required().placeholder('John Doe'),
        TextInput.make('email').email().required().placeholder('john@example.com'),
      ]),
      Tabs.make('details').tabs([
        Tab.make('Account').schema([
          Select.make('role').options({ admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }).required(),
          Toggle.make('active').label('Active'),
        ]),
        Tab.make('Profile').schema([
          Textarea.make('bio').rows(3).placeholder('About...'),
        ]),
      ]),
    ]).columns(1)
  }
  override table(): Table {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
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
    .defaultSort('id', 'desc')
    .emptyStateHeading('No users found')
    .emptyStateDescription('Try adjusting your search or filters.')
  }
}

class OrderResource extends Resource {
  static override navigationIcon = 'shopping-cart'
  static override navigationGroup = 'Commerce'
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
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('order_number').sortable().searchable(),
      BadgeColumn.make('status').colors({ pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'danger' }),
      TextColumn.make('total').money('USD').sortable(),
      TextColumn.make('created_at').dateTime().sortable(),
    ])
    .filters([
      SelectFilter.make('status').label('Status').options({ pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }),
    ])
    .actions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('id', 'desc')
  }
}

const userRes = new UserResource()
const orderRes = new OrderResource()
const resourceSchemas: Record<string, any> = { users: userRes.toSchema(), orders: orderRes.toSchema() }
const nav = NavigationBuilder.buildFromResources([UserResource, OrderResource])

// ── HTML ─────────────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mantiq Studio — Live Playground</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:{50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8'}}}}}<\/script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lucide-static@latest/font/lucide.min.css">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
.badge-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.badge-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.badge-info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
.badge-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.badge-primary { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
.badge-muted { background: #f4f4f5; color: #71717a; border: 1px solid #e4e4e7; }
.tab-active { border-bottom: 2px solid #2563eb; color: #2563eb; font-weight: 600; }
.tab-inactive { border-bottom: 2px solid transparent; color: #71717a; }
.sort-btn:hover { color: #2563eb; }
.row-selected { background: #eff6ff !important; }
</style>
</head>
<body class="bg-gray-50 text-gray-900">
<div class="flex min-h-screen">
  <aside class="w-[260px] bg-white border-r border-gray-200 flex flex-col shrink-0">
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-xs font-bold">M</div>
        <div><div class="text-sm font-semibold">Mantiq Studio</div><div class="text-xs text-gray-500">Playground</div></div>
      </div>
    </div>
    <nav class="flex-1 p-3" id="sidebar-nav"></nav>
    <div class="p-3 border-t border-gray-200">
      <div class="flex items-center gap-2 px-2 py-1.5">
        <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">AK</div>
        <div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">Abdullah Khan</div><div class="text-xs text-gray-500 truncate">admin@mantiq.dev</div></div>
      </div>
    </div>
  </aside>
  <main class="flex-1 overflow-auto">
    <div class="bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div class="flex gap-6">
        <button class="py-3 text-sm tab-active" id="tab-table" onclick="showView('table')">Table</button>
        <button class="py-3 text-sm tab-inactive" id="tab-form" onclick="showView('form')">Create</button>
        <button class="py-3 text-sm tab-inactive" id="tab-schema" onclick="showView('schema')">Schema</button>
      </div>
      <div id="stats-bar" class="flex gap-4 text-xs text-gray-500"></div>
    </div>
    <div class="p-6">
      <div id="table-view"></div>
      <div id="form-view" class="hidden"></div>
      <div id="schema-view" class="hidden"></div>
    </div>
  </main>
</div>
<script>
const schemas = ${JSON.stringify(resourceSchemas)};
const nav = ${JSON.stringify(nav)};
let activeResource = 'users';
let activeView = 'table';
let state = { page: 1, perPage: 10, search: '', sort: 'id', direction: 'desc', filters: {} };
let selectedIds = new Set();
let debounceTimer = null;

// ── Sidebar ──
function renderSidebar() {
  document.getElementById('sidebar-nav').innerHTML = nav.map(g => \`
    <div class="mb-4">
      <div class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">\${g.label}</div>
      \${g.items.map(it => {
        const slug = it.url.split('/').pop();
        return \`<button onclick="switchResource('\${slug}')" class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm \${activeResource===slug?'bg-primary-50 text-primary-700 font-medium':'text-gray-600 hover:bg-gray-100'}">
          <i class="lucide lucide-\${it.icon} w-4 h-4"></i>\${it.label}</button>\`;
      }).join('')}
    </div>
  \`).join('');
}

// ── Fetch data ──
async function fetchData() {
  const p = new URLSearchParams({ page: state.page, perPage: state.perPage, sort: state.sort, direction: state.direction });
  if (state.search) p.set('search', state.search);
  for (const [k,v] of Object.entries(state.filters)) { if (v) p.set('filter['+k+']', v); }
  const res = await fetch('/api/'+activeResource+'?'+p);
  return res.json();
}

async function fetchStats() {
  const res = await fetch('/api/stats');
  const s = await res.json();
  document.getElementById('stats-bar').innerHTML =
    \`<span>\${s.users} users</span><span>·</span><span>\${s.active} active</span><span>·</span><span>\${s.orders} orders</span><span>·</span><span>$\${s.revenue} revenue</span>\`;
}

// ── Render table ──
async function renderTable() {
  const { data, meta } = await fetchData();
  const schema = schemas[activeResource];
  const cols = schema.table.columns.filter(c => !c.hidden);
  const filters = schema.table.filters || [];

  let html = \`<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
      <h2 class="text-lg font-semibold capitalize mr-auto">\${activeResource}</h2>
      <input type="text" placeholder="Search..." value="\${state.search}" oninput="onSearch(this.value)"
        class="h-8 px-3 text-sm border border-gray-200 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-primary-200">
      \${filters.map(f => {
        const opts = f.type === 'ternary'
          ? \`<option value="">All</option><option value="true" \${state.filters[f.name]==='true'?'selected':''}>\${f.trueLabel||'Yes'}</option><option value="false" \${state.filters[f.name]==='false'?'selected':''}>\${f.falseLabel||'No'}</option>\`
          : \`<option value="">\${f.label||f.name}</option>\${Object.entries(f.options||{}).map(([k,v])=>\`<option value="\${k}" \${state.filters[f.name]===k?'selected':''}>\${v}</option>\`).join('')}\`;
        return \`<select onchange="onFilter('\${f.name}',this.value)" class="h-8 px-2 text-sm border border-gray-200 rounded-md">\${opts}</select>\`;
      }).join('')}
      <button onclick="showView('form')" class="h-8 px-3 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">+ Create</button>
      \${selectedIds.size ? \`<button onclick="bulkDelete()" class="h-8 px-3 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">Delete \${selectedIds.size}</button>\` : ''}
    </div>
    <table class="w-full">
      <thead><tr class="border-b border-gray-200 bg-gray-50/50">
        <th class="w-10 px-4 py-2"><input type="checkbox" onchange="toggleAll(this.checked)" class="rounded" \${selectedIds.size===data.length&&data.length?'checked':''}></th>
        \${cols.map(c => \`<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider \${c.sortable?'cursor-pointer sort-btn':''}" \${c.width?'style="width:'+c.width+'"':''} \${c.sortable?'onclick="onSort(\\''+c.name+'\\')\"':''}>\${c.label||c.name}\${c.sortable?(state.sort===c.name?(state.direction==='asc'?' ↑':' ↓'):' <span class=text-gray-300>↕</span>'):''}</th>\`).join('')}
        <th class="w-24 px-4 py-2"></th>
      </tr></thead>
      <tbody class="divide-y divide-gray-100">
        \${data.length ? data.map((row,i) => \`<tr class="hover:bg-gray-50 \${selectedIds.has(row.id)?'row-selected':''}">
          <td class="px-4 py-2.5"><input type="checkbox" \${selectedIds.has(row.id)?'checked':''} onchange="toggleRow(\${row.id})" class="rounded"></td>
          \${cols.map(c => \`<td class="px-4 py-2.5 text-sm">\${renderCell(c, row[c.name], row)}</td>\`).join('')}
          <td class="px-4 py-2.5 text-right"><div class="flex items-center justify-end gap-1">
            <button onclick="editRecord(\${row.id})" class="p-1.5 rounded hover:bg-gray-100" title="Edit"><i class="lucide lucide-pencil w-3.5 h-3.5 text-gray-400"></i></button>
            <button onclick="deleteRecord(\${row.id})" class="p-1.5 rounded hover:bg-red-50" title="Delete"><i class="lucide lucide-trash w-3.5 h-3.5 text-gray-400 hover:text-red-500"></i></button>
          </div></td>
        </tr>\`).join('') : \`<tr><td colspan="\${cols.length+2}" class="px-4 py-12 text-center text-sm text-gray-400">\${schema.table.emptyStateHeading||'No records'}</td></tr>\`}
      </tbody>
    </table>
    <div class="p-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
      <span>Showing \${meta.from}-\${meta.to} of \${meta.total}</span>
      <div class="flex items-center gap-1">
        <button onclick="goPage(\${meta.currentPage-1})" \${meta.currentPage<=1?'disabled':''} class="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40">Prev</button>
        \${Array.from({length:meta.lastPage},(_,i)=>i+1).map(p=>\`<button onclick="goPage(\${p})" class="px-2 py-1 rounded text-xs \${p===meta.currentPage?'bg-primary-600 text-white':'border border-gray-200 hover:bg-gray-50'}">\${p}</button>\`).join('')}
        <button onclick="goPage(\${meta.currentPage+1})" \${meta.currentPage>=meta.lastPage?'disabled':''} class="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40">Next</button>
      </div>
    </div></div>\`;
  document.getElementById('table-view').innerHTML = html;
}

function renderCell(col, val, row) {
  if (val === null || val === undefined) return '<span class="text-gray-300">—</span>';
  switch(col.type) {
    case 'badge': return \`<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium badge-\${col.colors?.[val]||'muted'}">\${val}</span>\`;
    case 'boolean': return val ? \`<i class="lucide lucide-\${col.trueIcon||'check'} w-4 h-4" style="color:\${col.trueColor==='success'?'#16a34a':'#3b82f6'}"></i>\` : \`<i class="lucide lucide-\${col.falseIcon||'x'} w-4 h-4" style="color:\${col.falseColor==='muted'?'#a1a1aa':'#dc2626'}"></i>\`;
    case 'text':
      if (col.dateTime||col.date) return new Date(val).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',...(col.dateTime?{hour:'2-digit',minute:'2-digit'}:{})});
      if (col.money) return typeof val==='number'?'$'+val.toFixed(2):val;
      if (col.copyable) return \`<span class="cursor-pointer group" onclick="navigator.clipboard.writeText('\${val}')">\${val} <i class="lucide lucide-copy w-3 h-3 text-gray-300 group-hover:text-primary-500 inline"></i></span>\`;
      return col.limit ? String(val).slice(0,col.limit) : val;
    default: return String(val);
  }
}

// ── Event handlers ──
function onSearch(val) { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { state.search=val; state.page=1; renderTable(); }, 300); }
function onFilter(name, val) { state.filters[name]=val; state.page=1; renderTable(); }
function onSort(col) { if(state.sort===col) state.direction=state.direction==='asc'?'desc':'asc'; else { state.sort=col; state.direction='asc'; } state.page=1; renderTable(); }
function goPage(p) { state.page=p; selectedIds.clear(); renderTable(); }
function toggleAll(checked) { document.querySelectorAll('tbody input[type=checkbox]').forEach(cb => { const id=parseInt(cb.getAttribute('onchange').match(/\\d+/)?.[0]); if(checked)selectedIds.add(id); else selectedIds.delete(id); }); renderTable(); }
function toggleRow(id) { if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); renderTable(); }
function switchResource(name) { activeResource=name; state={page:1,perPage:10,search:'',sort:'id',direction:'desc',filters:{}}; selectedIds.clear(); renderSidebar(); showView('table'); fetchStats(); }

async function deleteRecord(id) {
  if(!confirm('Delete this record?')) return;
  await fetch('/api/'+activeResource+'/'+id, {method:'DELETE'});
  renderTable(); fetchStats();
}
async function bulkDelete() {
  if(!confirm('Delete '+selectedIds.size+' record(s)?')) return;
  await fetch('/api/'+activeResource+'/bulk-delete', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[...selectedIds]})});
  selectedIds.clear(); renderTable(); fetchStats();
}
async function editRecord(id) {
  const res = await fetch('/api/'+activeResource+'/'+id);
  const {data} = await res.json();
  showView('form', data);
}

// ── Form view ──
function renderForm(record) {
  const schema = schemas[activeResource].form;
  const isEdit = !!record;
  document.getElementById('form-view').innerHTML = \`
    <div class="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h2 class="text-lg font-semibold mb-6 capitalize">\${isEdit?'Edit':'Create'} \${activeResource.slice(0,-1)}</h2>
      <form id="crud-form" onsubmit="submitForm(event,\${record?.id||'null'})" class="space-y-4">
        \${schema.components.map(c => renderFormField(c, record)).join('')}
        <div class="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">\${isEdit?'Save':'Create'}</button>
          <button type="button" onclick="showView('table')" class="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </form>
      <div id="form-errors" class="mt-4"></div>
    </div>\`;
}

function renderFormField(c, record) {
  const val = record?.[c.name] ?? c.default ?? '';
  switch(c.type) {
    case 'section': return \`<div class="rounded-lg border border-gray-200 p-4"><h3 class="text-sm font-semibold mb-1">\${c.heading||''}</h3>\${c.description?\`<p class="text-xs text-gray-500 mb-3">\${c.description}</p>\`:''}<div class="space-y-4">\${(c.schema||[]).map(s=>renderFormField(s,record)).join('')}</div></div>\`;
    case 'tabs': return \`<div class="space-y-4">\${(c.tabs[0]?.schema||[]).map(s=>renderFormField(s,record)).join('')}</div>\`;
    case 'text-input': return \`<div><label class="block text-sm font-medium text-gray-700 mb-1">\${c.label||c.name}\${c.required?' <span class=text-red-500>*</span>':''}</label><div class="relative">\${c.prefix?\`<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">\${c.prefix}</span>\`:''}<input name="\${c.name}" type="\${c.inputType||'text'}" value="\${val}" placeholder="\${c.placeholder||''}" \${c.disabled?'disabled':''} \${c.required?'required':''} class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg \${c.disabled?'bg-gray-50 text-gray-400':''} \${c.prefix?'pl-7':''}"></div>\${c.helperText?\`<p class="text-xs text-gray-400 mt-1">\${c.helperText}</p>\`:''}</div>\`;
    case 'textarea': return \`<div><label class="block text-sm font-medium text-gray-700 mb-1">\${c.label||c.name}</label><textarea name="\${c.name}" rows="\${c.rows||3}" placeholder="\${c.placeholder||''}" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">\${val}</textarea></div>\`;
    case 'select': return \`<div><label class="block text-sm font-medium text-gray-700 mb-1">\${c.label||c.name}\${c.required?' <span class=text-red-500>*</span>':''}</label><select name="\${c.name}" \${c.required?'required':''} class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white"><option value="">Select...</option>\${Object.entries(c.options||{}).map(([k,v])=>\`<option value="\${k}" \${String(val)===k?'selected':''}>\${v}</option>\`).join('')}</select></div>\`;
    case 'toggle': return \`<div class="flex items-center gap-3"><input type="checkbox" name="\${c.name}" value="1" \${val?'checked':''} class="rounded border-gray-300"><label class="text-sm font-medium text-gray-700">\${c.label||c.name}</label></div>\`;
    default: return '';
  }
}

async function submitForm(e, editId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = {};
  for(const [k,v] of fd.entries()) body[k]=v;
  // Handle toggle/checkbox
  const schema = schemas[activeResource].form;
  function findToggles(comps) { for(const c of comps) { if(c.type==='toggle') { body[c.name]=fd.has(c.name)?1:0; } if(c.schema) findToggles(c.schema); if(c.tabs) c.tabs.forEach(t=>findToggles(t.schema||[])); }}
  findToggles(schema.components);

  const url = editId ? '/api/'+activeResource+'/'+editId : '/api/'+activeResource;
  const method = editId ? 'PUT' : 'POST';
  const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const result = await res.json();
  if(res.status===422) {
    document.getElementById('form-errors').innerHTML = \`<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">\${Object.entries(result.errors||{}).map(([k,v])=>\`<div><b>\${k}:</b> \${v.join(', ')}</div>\`).join('')}</div>\`;
  } else {
    showView('table'); fetchStats();
  }
}

// ── View switching ──
function showView(view, record) {
  activeView = view;
  ['table','form','schema'].forEach(v => {
    document.getElementById(v+'-view').classList.toggle('hidden', v!==view);
    document.getElementById('tab-'+v).className = 'py-3 text-sm '+(v===view?'tab-active':'tab-inactive');
  });
  if(view==='table') renderTable();
  if(view==='form') renderForm(record||null);
  if(view==='schema') document.getElementById('schema-view').innerHTML=\`<div class="bg-white rounded-xl border border-gray-200 p-4"><pre class="overflow-auto max-h-[80vh] text-xs text-gray-700">\${JSON.stringify(schemas[activeResource],null,2)}</pre></div>\`;
}

renderSidebar(); renderTable(); fetchStats();
</script>
</body></html>`;

// ── Server ───────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: 4200,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    // API routes
    if (path === '/api/stats') return handleStats()

    const match = path.match(/^\/api\/(users|orders)(?:\/(.+))?$/)
    if (match) {
      const [, resource, rest] = match
      if (req.method === 'GET' && !rest) return handleList(resource, url)
      if (req.method === 'POST' && !rest) return handleCreate(resource, await req.json())
      if (req.method === 'POST' && rest === 'bulk-delete') return handleBulkDelete(resource, (await req.json()).ids)
      if (req.method === 'GET' && rest) return handleShow(resource, rest)
      if (req.method === 'PUT' && rest) return handleUpdate(resource, rest, await req.json())
      if (req.method === 'DELETE' && rest) return handleDelete(resource, rest)
    }

    // SPA
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  },
})

console.log(`\n  \x1b[32m●\x1b[0m  \x1b[1mMantiq Studio — Live Playground\x1b[0m`)
console.log(`     http://localhost:${server.port}`)
console.log(`\n  \x1b[2mSQLite in-memory • 15 users • 12 orders`)
console.log(`  Search, filter, sort, paginate, create, edit, delete — all live\x1b[0m\n`)
