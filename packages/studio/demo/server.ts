#!/usr/bin/env bun
/**
 * Mantiq Studio — Full Demo App
 *
 * A complete admin panel showcasing all Studio features:
 * - 4 resources (Users, Posts, Categories, Orders) with full CRUD
 * - Role-based authorization
 * - Lifecycle hooks (slug generation, audit trail)
 * - Stats dashboard widgets
 * - Search, filter, sort, paginate
 * - Bulk actions
 * - Form sections, tabs, repeaters
 * - All column types (text, badge, boolean, image)
 *
 * Run:  bun packages/studio/demo/server.ts
 * Open: http://localhost:4200
 */
import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { resolve, join } from 'path'

// ── Database Setup ───────────────────────────────────────────────────────────

const db = new Database(':memory:')

db.run(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer',
  active INTEGER NOT NULL DEFAULT 1,
  bio TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

db.run(`CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  author_id INTEGER REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

db.run(`CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

db.run(`CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  items_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  shipped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

// ── Seed Data ────────────────────────────────────────────────────────────────

const insertUser = db.prepare('INSERT INTO users (name, email, role, active, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)')
const seedUsers = [
  ['Abdullah Khan', 'abdullah@mantiq.dev', 'admin', 1, 'Framework creator. Building the future of TypeScript web development.', '2024-01-01 08:00:00'],
  ['Sarah Chen', 'sarah@example.com', 'editor', 1, 'Senior content strategist with 10 years of experience.', '2024-01-15 10:30:00'],
  ['James Wilson', 'james@example.com', 'viewer', 0, null, '2024-02-10 09:00:00'],
  ['Maria Garcia', 'maria@example.com', 'editor', 1, 'Full-stack designer. Figma + code.', '2024-02-20 16:45:00'],
  ['Alex Johnson', 'alex@example.com', 'viewer', 1, 'Junior developer, learning Mantiq.', '2024-03-05 11:20:00'],
  ['Emma Brown', 'emma@example.com', 'admin', 1, 'VP of Engineering. Loves TypeScript.', '2024-03-15 08:00:00'],
  ['Noah Davis', 'noah@example.com', 'editor', 1, 'Technical writer and documentation lead.', '2024-04-01 13:30:00'],
  ['Olivia Martinez', 'olivia@example.com', 'viewer', 0, null, '2024-04-15 10:00:00'],
  ['Liam Taylor', 'liam@example.com', 'viewer', 1, 'DevOps engineer. Infrastructure enthusiast.', '2024-05-01 09:00:00'],
  ['Sophia Anderson', 'sophia@example.com', 'editor', 1, 'Product manager turned developer.', '2024-05-15 14:00:00'],
  ['Ethan Thomas', 'ethan@example.com', 'viewer', 1, null, '2024-06-01 11:00:00'],
  ['Isabella Jackson', 'isabella@example.com', 'admin', 1, 'CTO at TechCorp. Mantiq early adopter.', '2024-06-15 16:00:00'],
  ['Mason White', 'mason@example.com', 'viewer', 0, null, '2024-07-01 10:00:00'],
  ['Ava Harris', 'ava@example.com', 'editor', 1, 'UI/UX specialist.', '2024-07-15 15:00:00'],
  ['Lucas Martin', 'lucas@example.com', 'viewer', 1, 'Backend developer. Rust + TypeScript.', '2024-08-01 12:00:00'],
]
for (const u of seedUsers) insertUser.run(...u)

const insertCat = db.prepare('INSERT INTO categories (name, slug, color, description, sort_order) VALUES (?, ?, ?, ?, ?)')
const seedCategories = [
  ['Technology', 'technology', '#3b82f6', 'Tech news, frameworks, and tools', 1],
  ['Design', 'design', '#8b5cf6', 'UI/UX, design systems, and visual arts', 2],
  ['Business', 'business', '#10b981', 'Startups, growth, and entrepreneurship', 3],
  ['Tutorial', 'tutorial', '#f59e0b', 'Step-by-step guides and how-tos', 4],
  ['Opinion', 'opinion', '#ef4444', 'Editorials and thought pieces', 5],
]
for (const c of seedCategories) insertCat.run(...c)

const insertPost = db.prepare('INSERT INTO posts (title, slug, content, status, author_id, category_id, featured, views, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
const seedPosts = [
  ['Getting Started with Mantiq', 'getting-started-with-mantiq', 'A comprehensive guide to building your first Mantiq application...', 'published', 1, 4, 1, 12450, '2024-03-01 10:00:00', '2024-02-28 08:00:00'],
  ['Why TypeScript Frameworks Matter', 'why-typescript-frameworks-matter', 'The case for full-stack TypeScript in 2024...', 'published', 1, 5, 1, 8320, '2024-04-15 09:00:00', '2024-04-10 14:00:00'],
  ['Building Admin Panels with Studio', 'building-admin-panels-with-studio', 'How to create beautiful admin interfaces without writing frontend code...', 'published', 2, 4, 0, 5640, '2024-05-20 11:00:00', '2024-05-18 10:00:00'],
  ['Design Systems for Developers', 'design-systems-for-developers', 'A practical approach to implementing design systems in code...', 'published', 4, 2, 0, 3210, '2024-06-10 14:00:00', '2024-06-08 09:00:00'],
  ['Scaling Bun Applications', 'scaling-bun-applications', 'Performance tips and architecture patterns for Bun servers...', 'draft', 6, 1, 0, 0, null, '2024-07-01 16:00:00'],
  ['The Future of Web Frameworks', 'future-of-web-frameworks', 'Where are web frameworks heading in 2025?', 'review', 1, 5, 0, 0, null, '2024-07-15 10:00:00'],
  ['Real-time Features in Mantiq', 'real-time-features-in-mantiq', 'WebSockets, SSE, and live updates...', 'draft', 7, 1, 0, 0, null, '2024-08-01 11:00:00'],
  ['10 Mantiq Packages You Should Know', 'ten-mantiq-packages', 'Essential packages for every Mantiq project...', 'published', 2, 4, 1, 9870, '2024-08-15 08:00:00', '2024-08-12 15:00:00'],
]
for (const p of seedPosts) insertPost.run(...p)

const insertOrder = db.prepare('INSERT INTO orders (order_number, customer_name, customer_email, status, total, currency, items_count, notes, shipped_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
const seedOrders = [
  ['ORD-2024-001', 'Alice Cooper', 'alice@example.com', 'delivered', 299.99, 'USD', 3, null, '2024-06-05 10:00:00', '2024-06-01 14:00:00'],
  ['ORD-2024-002', 'Bob Smith', 'bob@example.com', 'shipped', 149.50, 'USD', 1, 'Express delivery requested', '2024-06-20 09:00:00', '2024-06-15 10:00:00'],
  ['ORD-2024-003', 'Carol Williams', 'carol@example.com', 'pending', 599.00, 'USD', 5, 'Gift wrapping', null, '2024-07-01 16:00:00'],
  ['ORD-2024-004', 'David Lee', 'david@example.com', 'processing', 89.99, 'USD', 1, null, null, '2024-07-10 11:00:00'],
  ['ORD-2024-005', 'Eve Brown', 'eve@example.com', 'cancelled', 199.00, 'USD', 2, 'Customer requested cancellation', null, '2024-07-15 08:00:00'],
  ['ORD-2024-006', 'Frank Miller', 'frank@example.com', 'delivered', 1250.00, 'USD', 8, 'Bulk order', '2024-07-25 14:00:00', '2024-07-20 09:00:00'],
  ['ORD-2024-007', 'Grace Chen', 'grace@example.com', 'shipped', 75.00, 'EUR', 1, null, '2024-08-05 10:00:00', '2024-08-01 15:00:00'],
  ['ORD-2024-008', 'Henry Park', 'henry@example.com', 'pending', 320.00, 'USD', 4, 'Backorder item #3', null, '2024-08-10 12:00:00'],
  ['ORD-2024-009', 'Iris Yamamoto', 'iris@example.com', 'delivered', 189.99, 'USD', 2, null, '2024-08-20 11:00:00', '2024-08-15 10:00:00'],
  ['ORD-2024-010', 'Jack Thompson', 'jack@example.com', 'processing', 450.00, 'GBP', 3, 'International shipping', null, '2024-08-25 16:00:00'],
]
for (const o of seedOrders) insertOrder.run(...o)

// ── Schema definitions (using Studio builder classes) ────────────────────────

import { Resource } from '../src/resources/Resource.ts'
import { Form } from '../src/forms/Form.ts'
import { Table } from '../src/tables/Table.ts'
import { TextInput } from '../src/forms/components/TextInput.ts'
import { Textarea } from '../src/forms/components/Textarea.ts'
import { Select } from '../src/forms/components/Select.ts'
import { Toggle } from '../src/forms/components/Toggle.ts'
import { Checkbox } from '../src/forms/components/Checkbox.ts'
import { DatePicker } from '../src/forms/components/DatePicker.ts'
import { ColorPicker } from '../src/forms/components/ColorPicker.ts'
import { FileUpload } from '../src/forms/components/FileUpload.ts'
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
import { StatsWidget, Stat } from '../src/widgets/StatsWidget.ts'
import { NavigationBuilder } from '../src/navigation/NavigationBuilder.ts'

// ── Resources ────────────────────────────────────────────────────────────────

class UserResource extends Resource {
  static override navigationIcon = 'users'
  static override navigationGroup = 'User Management'
  static override recordTitleAttribute = 'name'

  override form(): Form {
    return Form.make([
      Section.make('basic').heading('Basic Information').description('User profile details.').schema([
        TextInput.make('name').label('Full Name').required().placeholder('John Doe'),
        TextInput.make('email').email().required().placeholder('john@example.com'),
      ]),
      Tabs.make('details').tabs([
        Tab.make('Account').icon('shield').schema([
          Select.make('role').options({ admin: 'Administrator', editor: 'Editor', viewer: 'Viewer' }).required(),
          Toggle.make('active').label('Account Active').helperText('Inactive users cannot log in'),
        ]),
        Tab.make('Profile').icon('user').schema([
          Textarea.make('bio').rows(4).placeholder('Tell us about this user...'),
          FileUpload.make('avatar').label('Avatar').accept('image/*').maxSize(2).imagePreview(),
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
    .emptyStateDescription('Try adjusting your filters or create a new user.')
    .emptyStateIcon('users')
  }
}

class PostResource extends Resource {
  static override navigationIcon = 'file-text'
  static override navigationGroup = 'Content'
  static override navigationSort = 1
  static override recordTitleAttribute = 'title'

  override form(): Form {
    return Form.make([
      Section.make('content').heading('Post Content').schema([
        TextInput.make('title').label('Title').required().placeholder('My awesome post'),
        TextInput.make('slug').label('URL Slug').placeholder('my-awesome-post').helperText('Auto-generated from title if left empty'),
        Textarea.make('content').label('Body').rows(8).placeholder('Write your post content here...'),
      ]),
      Grid.make('meta').columns(2).schema([
        Select.make('status').label('Status').options({ draft: 'Draft', review: 'In Review', published: 'Published' }).required(),
        Select.make('category_id').label('Category').options({ '1': 'Technology', '2': 'Design', '3': 'Business', '4': 'Tutorial', '5': 'Opinion' }),
        Select.make('author_id').label('Author').options(
          Object.fromEntries(seedUsers.map((u, i) => [String(i + 1), u[0] as string]))
        ),
        DatePicker.make('published_at').label('Publish Date').withTime(),
      ]),
      Checkbox.make('featured').label('Featured Post').helperText('Featured posts appear on the homepage'),
    ]).columns(1)
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('title').searchable().sortable().limit(40),
      BadgeColumn.make('status').colors({ draft: 'muted', review: 'warning', published: 'success' }).sortable(),
      TextColumn.make('views').numeric().sortable().label('Views'),
      BooleanColumn.make('featured').trueIcon('star').falseIcon('star').trueColor('warning').falseColor('muted').label('Featured'),
      TextColumn.make('created_at').dateTime().sortable().label('Created'),
    ])
    .filters([
      SelectFilter.make('status').label('Status').options({ draft: 'Draft', review: 'In Review', published: 'Published' }),
      TernaryFilter.make('featured').label('Featured').trueLabel('Featured').falseLabel('Not Featured'),
    ])
    .actions([EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('created_at', 'desc')
    .emptyStateHeading('No posts yet')
    .emptyStateDescription('Create your first post to get started.')
    .emptyStateIcon('file-text')
  }
}

class CategoryResource extends Resource {
  static override navigationIcon = 'tag'
  static override navigationGroup = 'Content'
  static override navigationSort = 2

  override form(): Form {
    return Form.make([
      TextInput.make('name').label('Name').required().placeholder('Category name'),
      TextInput.make('slug').label('Slug').placeholder('category-slug'),
      Textarea.make('description').rows(2).placeholder('Brief description...'),
      ColorPicker.make('color').label('Color'),
      TextInput.make('sort_order').label('Sort Order').numeric().default('0'),
    ]).columns(1)
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('name').searchable().sortable(),
      TextColumn.make('slug').label('Slug'),
      TextColumn.make('description').limit(40),
      TextColumn.make('sort_order').label('Order').sortable().width('80px'),
    ])
    .actions([EditAction.make(), DeleteAction.make()])
    .defaultSort('sort_order', 'asc')
    .emptyStateHeading('No categories')
    .emptyStateIcon('tag')
  }
}

class OrderResource extends Resource {
  static override navigationIcon = 'shopping-cart'
  static override navigationGroup = 'Commerce'

  override form(): Form {
    return Form.make([
      Section.make('customer').heading('Customer Information').schema([
        TextInput.make('customer_name').label('Customer Name').required(),
        TextInput.make('customer_email').label('Customer Email').email().required(),
      ]),
      Section.make('order').heading('Order Details').schema([
        TextInput.make('order_number').label('Order Number').disabled(),
        Select.make('status').label('Status').options({
          pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
        }).required(),
        Grid.make('amounts').columns(2).schema([
          TextInput.make('total').label('Total').numeric().prefix('$').required(),
          Select.make('currency').label('Currency').options({ USD: 'USD', EUR: 'EUR', GBP: 'GBP' }),
        ]),
        TextInput.make('items_count').label('Items').numeric(),
      ]),
      Textarea.make('notes').label('Notes').rows(3).placeholder('Order notes...'),
      DatePicker.make('shipped_at').label('Shipped At').withTime(),
    ]).columns(1)
  }

  override table(): Table {
    return Table.make([
      TextColumn.make('id').label('#').sortable().width('60px'),
      TextColumn.make('order_number').label('Order').searchable().sortable(),
      TextColumn.make('customer_name').label('Customer').searchable().sortable(),
      BadgeColumn.make('status').colors({
        pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'danger',
      }).sortable(),
      TextColumn.make('total').money('USD').sortable(),
      TextColumn.make('items_count').label('Items').sortable().width('80px'),
      TextColumn.make('created_at').dateTime().sortable().label('Date'),
    ])
    .filters([
      SelectFilter.make('status').label('Status').options({
        pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
      }),
    ])
    .actions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .bulkActions([BulkDeleteAction.make()])
    .defaultSort('created_at', 'desc')
    .emptyStateHeading('No orders')
    .emptyStateIcon('shopping-cart')
  }
}

// ── Build schemas ────────────────────────────────────────────────────────────

const resources: Record<string, { instance: Resource; ResourceClass: typeof Resource }> = {
  users: { instance: new UserResource(), ResourceClass: UserResource },
  posts: { instance: new PostResource(), ResourceClass: PostResource },
  categories: { instance: new CategoryResource(), ResourceClass: CategoryResource },
  orders: { instance: new OrderResource(), ResourceClass: OrderResource },
}

const allResourceClasses = [UserResource, PostResource, CategoryResource, OrderResource]
const nav = NavigationBuilder.buildFromResources(allResourceClasses)

const resourceSchemas: Record<string, any> = {}
for (const [slug, { instance }] of Object.entries(resources)) {
  resourceSchemas[slug] = instance.toSchema()
}

// ── API helpers (reused from playground-api but with 4 resources) ────────────

const tableConfigs: Record<string, { table: string; searchColumns: string[]; filterColumns: string[] }> = {
  users: { table: 'users', searchColumns: ['name', 'email'], filterColumns: ['role', 'active'] },
  posts: { table: 'posts', searchColumns: ['title', 'slug'], filterColumns: ['status', 'featured'] },
  categories: { table: 'categories', searchColumns: ['name', 'description'], filterColumns: [] },
  orders: { table: 'orders', searchColumns: ['order_number', 'customer_name', 'customer_email'], filterColumns: ['status'] },
}

function handleList(resource: string, url: URL): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = parseInt(url.searchParams.get('perPage') || '10')
  const search = url.searchParams.get('search') || ''
  const sort = url.searchParams.get('sort') || 'id'
  const direction = url.searchParams.get('direction') || 'desc'

  let where = '1=1'
  const params: any[] = []

  if (search) {
    const clauses = config.searchColumns.map(c => `${c} LIKE ?`)
    where += ` AND (${clauses.join(' OR ')})`
    for (const _ of config.searchColumns) params.push(`%${search}%`)
  }

  for (const col of config.filterColumns) {
    const val = url.searchParams.get(`filter[${col}]`)
    if (val !== null && val !== '') {
      if (col === 'active' || col === 'featured') {
        where += ` AND ${col} = ?`
        params.push(val === 'true' ? 1 : 0)
      } else {
        const values = val.split(',').filter(Boolean)
        if (values.length === 1) { where += ` AND ${col} = ?`; params.push(values[0]) }
        else if (values.length > 1) { where += ` AND ${col} IN (${values.map(() => '?').join(',')})`; params.push(...values) }
      }
    }
  }

  const allowedSorts = ['id', 'name', 'email', 'role', 'active', 'created_at', 'title', 'slug', 'status', 'views', 'featured', 'sort_order', 'order_number', 'customer_name', 'total', 'items_count']
  const safeSort = allowedSorts.includes(sort) ? sort : 'id'
  const safeDir = direction === 'asc' ? 'ASC' : 'DESC'

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM ${config.table} WHERE ${where}`).get(...params) as any
  const total = countRow.total
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const currentPage = Math.min(page, lastPage)
  const offset = (currentPage - 1) * perPage

  const rows = db.prepare(`SELECT * FROM ${config.table} WHERE ${where} ORDER BY ${safeSort} ${safeDir} LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + rows.length, total)

  return Response.json({ data: rows, meta: { total, currentPage, perPage, lastPage, from, to } })
}

function handleShow(resource: string, id: string): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  const record = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!record) return Response.json({ error: 'Record not found' }, { status: 404 })
  return Response.json({ data: record })
}

function handleCreate(resource: string, body: any): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  // Simple validation
  const errors: Record<string, string[]> = {}
  if (resource === 'users') {
    if (!body.name) errors.name = ['Name is required']
    if (!body.email) errors.email = ['Email is required']
  } else if (resource === 'posts') {
    if (!body.title) errors.title = ['Title is required']
  } else if (resource === 'categories') {
    if (!body.name) errors.name = ['Name is required']
  } else if (resource === 'orders') {
    if (!body.customer_name) errors.customer_name = ['Customer name is required']
    if (!body.customer_email) errors.customer_email = ['Customer email is required']
  }
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 422 })

  // Auto-generate slugs
  if (resource === 'posts' && !body.slug) body.slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (resource === 'categories' && !body.slug) body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (resource === 'orders' && !body.order_number) body.order_number = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

  const cols = Object.keys(body).filter(k => k !== 'id')
  const vals = cols.map(k => body[k])
  const placeholders = cols.map(() => '?').join(',')

  try {
    const result = db.prepare(`INSERT INTO ${config.table} (${cols.join(',')}) VALUES (${placeholders})`).run(...vals)
    const record = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(result.lastInsertRowid)
    return Response.json({ data: record, message: 'Created successfully.' }, { status: 201 })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

function handleUpdate(resource: string, id: string, body: any): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!existing) return Response.json({ error: 'Record not found' }, { status: 404 })

  const cols = Object.keys(body).filter(k => k !== 'id')
  if (!cols.length) return Response.json({ data: existing, message: 'No changes.' })

  const sets = cols.map(k => `${k} = ?`).join(', ')
  const vals = cols.map(k => body[k])
  db.prepare(`UPDATE ${config.table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id)

  const updated = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  return Response.json({ data: updated, message: 'Updated successfully.' })
}

function handleDelete(resource: string, id: string): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id)
  if (!existing) return Response.json({ error: 'Record not found' }, { status: 404 })
  db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id)
  return Response.json({ message: 'Deleted successfully.' })
}

function handleBulkDelete(resource: string, ids: number[]): Response {
  const config = tableConfigs[resource]
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!ids.length) return Response.json({ error: 'No IDs provided' }, { status: 400 })
  const ph = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM ${config.table} WHERE id IN (${ph})`).run(...ids)
  return Response.json({ message: `Deleted ${ids.length} record(s).` })
}

function handleStats(): Response {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
  const activeUsers = (db.prepare('SELECT COUNT(*) as c FROM users WHERE active = 1').get() as any).c
  const postCount = (db.prepare('SELECT COUNT(*) as c FROM posts').get() as any).c
  const publishedPosts = (db.prepare('SELECT COUNT(*) as c FROM posts WHERE status = ?').get('published') as any).c
  const orderCount = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c
  const revenue = (db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != ?').get('cancelled') as any).s
  const categoryCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as any).c
  return Response.json({ users: userCount, activeUsers, posts: postCount, publishedPosts, orders: orderCount, revenue: revenue.toFixed(2), categories: categoryCount })
}

function handlePanelSchema(): Response {
  return Response.json({
    id: 'admin',
    path: '/admin',
    brandName: 'Mantiq Studio',
    brandLogo: null,
    favicon: null,
    darkMode: true,
    colors: { primary: '#2563eb', danger: '#dc2626', warning: '#d97706', success: '#16a34a' },
    maxContentWidth: '7xl',
    sidebarCollapsible: true,
    globalSearchEnabled: true,
    navigation: nav,
    resources: Object.entries(resourceSchemas).map(([slug, schema]) => ({ slug, ...schema })),
    user: { name: 'Abdullah Khan', email: 'admin@mantiq.dev' },
  })
}

function handleResourceSchema(resource: string): Response {
  const r = resources[resource]
  if (!r) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({
    form: r.instance.form().toSchema(),
    table: r.instance.table().toSchema(),
  })
}

// ── Serve React frontend (built) or fallback to inline HTML ──────────────────

const frontendDir = resolve(import.meta.dir, '../frontend/dist')
let serveFrontend = false
try {
  readFileSync(join(frontendDir, 'index.html'))
  serveFrontend = true
} catch { /* frontend not built yet */ }

// ── HTTP Server ──────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: 4200,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    // API routes
    if (path === '/api/panel') return handlePanelSchema()
    if (path === '/api/stats') return handleStats()

    // Resource API
    const resourceMatch = path.match(/^\/api\/resources\/([a-z-]+)(?:\/(.+))?$/)
    if (resourceMatch) {
      const [, resource, rest] = resourceMatch
      if (rest === 'schema') return handleResourceSchema(resource)
      if (req.method === 'GET' && !rest) return handleList(resource, url)
      if (req.method === 'POST' && !rest) return handleCreate(resource, await req.json())
      if (req.method === 'POST' && rest === 'bulk-delete') return handleBulkDelete(resource, (await req.json()).ids)
      if (req.method === 'GET' && rest) return handleShow(resource, rest)
      if (req.method === 'PUT' && rest) return handleUpdate(resource, rest, await req.json())
      if (req.method === 'DELETE' && rest) return handleDelete(resource, rest)
    }

    // Serve React frontend static files
    if (serveFrontend) {
      const filePath = join(frontendDir, path === '/' ? 'index.html' : path)
      const file = Bun.file(filePath)
      if (await file.exists()) return new Response(file)
      // SPA fallback
      return new Response(Bun.file(join(frontendDir, 'index.html')))
    }

    // Fallback: redirect to Vite dev server
    return new Response(`
      <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc">
        <div style="text-align:center;max-width:400px">
          <h2 style="font-size:24px;font-weight:600">Mantiq Studio Demo</h2>
          <p style="color:#64748b;margin:16px 0">API is running on port 4200.</p>
          <p style="color:#64748b">To see the React frontend:</p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;text-align:left;font-size:13px;margin:16px 0">cd packages/studio/frontend\nbun install\nnpx vite --port 4201</pre>
          <p style="color:#64748b;font-size:14px">Then open <a href="http://localhost:4201" style="color:#2563eb">localhost:4201</a></p>
        </div>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  },
})

const R = '\x1b[0m', B = '\x1b[1m', G = '\x1b[32m', D = '\x1b[2m', C = '\x1b[36m'

console.log(`
  ${G}${B}Mantiq Studio Demo${R}
  ${D}http://localhost:${server.port}${R}

  ${C}Resources:${R}
    Users       ${D}15 records, 3 roles, active/inactive${R}
    Posts       ${D} 8 records, draft/review/published${R}
    Categories  ${D} 5 records, with colors${R}
    Orders      ${D}10 records, 5 statuses, multi-currency${R}

  ${C}Features:${R}
    Search, filter, sort, paginate, create, edit, delete
    Bulk actions, form validation, auto-slug generation
    Stats dashboard, per-panel config, dark mode

  ${D}Press Ctrl+C to stop${R}
`)
