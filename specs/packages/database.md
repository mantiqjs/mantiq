# @mantiq/database — Package Specification

> The data layer. Owns database connections, query building, schema migrations, an Active Record ORM, relationships, seeders, and factories.

**npm:** `@mantiq/database`
**Dependencies:** `@mantiq/core` (container, config, events)
**External drivers:** `bun:sqlite` (built-in), `pg` (optional), `mysql2` (optional)

---

## 1. Package Structure

```
packages/database/
├── src/
│   ├── index.ts
│   ├── contracts/
│   │   ├── Connection.ts
│   │   ├── QueryBuilder.ts
│   │   ├── SchemaBuilder.ts
│   │   ├── Blueprint.ts
│   │   ├── Grammar.ts
│   │   ├── Seeder.ts
│   │   ├── Factory.ts
│   │   └── Paginator.ts
│   ├── drivers/
│   │   ├── SQLiteConnection.ts
│   │   ├── PostgresConnection.ts
│   │   ├── MySQLConnection.ts
│   │   ├── SQLiteGrammar.ts
│   │   ├── PostgresGrammar.ts
│   │   └── MySQLGrammar.ts
│   ├── query/
│   │   ├── Builder.ts
│   │   ├── JoinClause.ts
│   │   ├── Expression.ts          ← raw()
│   │   └── Processor.ts           ← post-processes query results
│   ├── schema/
│   │   ├── SchemaBuilder.ts
│   │   ├── Blueprint.ts
│   │   ├── ColumnDefinition.ts
│   │   └── ForeignKeyDefinition.ts
│   ├── migrations/
│   │   ├── Migrator.ts
│   │   ├── MigrationRepository.ts ← tracks state in `migrations` table
│   │   └── MigrationCreator.ts    ← generates migration file stubs
│   ├── orm/
│   │   ├── Model.ts
│   │   ├── ModelQueryBuilder.ts   ← extends Builder, adds model awareness
│   │   ├── Relations.ts           ← hasOne, hasMany, belongsTo, belongsToMany
│   │   ├── Collection.ts          ← typed array wrapper for model results
│   │   └── SoftDeletes.ts         ← mixin trait
│   ├── seeders/
│   │   └── Seeder.ts
│   ├── factories/
│   │   └── Factory.ts
│   ├── errors/
│   │   ├── QueryError.ts
│   │   ├── ModelNotFoundError.ts
│   │   └── ConnectionError.ts
│   └── providers/
│       └── DatabaseServiceProvider.ts
├── tests/
│   ├── unit/
│   │   ├── query-builder.test.ts
│   │   ├── schema.test.ts
│   │   └── model.test.ts
│   └── integration/
│       ├── crud.spec.ts
│       ├── relationships.spec.ts
│       └── migrations.spec.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. Config File

`config/database.ts`:

```typescript
import { env } from '@mantiq/core'

export default {
  default: env('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite',
      database: env('DB_DATABASE', 'database/database.sqlite'),
    },
    postgres: {
      driver: 'postgres',
      host:     env('DB_HOST', '127.0.0.1'),
      port:     Number(env('DB_PORT', '5432')),
      database: env('DB_DATABASE', 'mantiq'),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
    mysql: {
      driver: 'mysql',
      host:     env('DB_HOST', '127.0.0.1'),
      port:     Number(env('DB_PORT', '3306')),
      database: env('DB_DATABASE', 'mantiq'),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
  },
}
```

---

## 3. Connection Contract

```typescript
interface DatabaseConnection {
  /**
   * Execute a raw SQL query and return all rows.
   */
  select(sql: string, bindings?: any[]): Promise<Record<string, any>[]>

  /**
   * Execute an INSERT/UPDATE/DELETE. Returns rows affected.
   */
  statement(sql: string, bindings?: any[]): Promise<number>

  /**
   * Execute an INSERT and return the new row's ID.
   */
  insertGetId(sql: string, bindings?: any[]): Promise<number | bigint>

  /**
   * Run a callback inside a database transaction.
   * Commits on success, rolls back on any thrown error.
   */
  transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>

  /**
   * Start the query builder for a given table.
   */
  table(name: string): QueryBuilder

  /**
   * Access the schema builder.
   */
  schema(): SchemaBuilder

  /**
   * Get the driver name ('sqlite' | 'postgres' | 'mysql').
   */
  getDriverName(): string
}
```

---

## 4. Query Builder

### 4.1 Interface

```typescript
interface QueryBuilder {
  // ── Selection ────────────────────────────────────────────────────────────
  select(...columns: string[]): this
  selectRaw(expression: string, bindings?: any[]): this
  distinct(): this
  addSelect(...columns: string[]): this

  // ── Conditions ───────────────────────────────────────────────────────────
  where(column: string, value: any): this
  where(column: string, operator: Operator, value: any): this
  where(callback: (query: QueryBuilder) => void): this        // grouped where
  orWhere(column: string, value: any): this
  orWhere(column: string, operator: Operator, value: any): this
  whereIn(column: string, values: any[]): this
  whereNotIn(column: string, values: any[]): this
  whereNull(column: string): this
  whereNotNull(column: string): this
  whereBetween(column: string, range: [any, any]): this
  whereRaw(sql: string, bindings?: any[]): this

  // ── Joins ────────────────────────────────────────────────────────────────
  join(table: string, first: string, operator: string, second: string): this
  leftJoin(table: string, first: string, operator: string, second: string): this
  rightJoin(table: string, first: string, operator: string, second: string): this

  // ── Ordering / Grouping ──────────────────────────────────────────────────
  orderBy(column: string, direction?: 'asc' | 'desc'): this
  orderByDesc(column: string): this
  groupBy(...columns: string[]): this
  having(column: string, operator: string, value: any): this

  // ── Pagination ───────────────────────────────────────────────────────────
  limit(value: number): this
  offset(value: number): this
  skip(value: number): this   // alias for offset
  take(value: number): this   // alias for limit

  // ── Execution ────────────────────────────────────────────────────────────
  get(): Promise<Record<string, any>[]>
  first(): Promise<Record<string, any> | null>
  firstOrFail(): Promise<Record<string, any>>  // throws ModelNotFoundError
  find(id: number | string): Promise<Record<string, any> | null>
  value(column: string): Promise<any>          // get single column value
  pluck(column: string): Promise<any[]>        // array of values from one column
  exists(): Promise<boolean>
  doesntExist(): Promise<boolean>

  // ── Aggregates ───────────────────────────────────────────────────────────
  count(column?: string): Promise<number>
  sum(column: string): Promise<number>
  avg(column: string): Promise<number>
  min(column: string): Promise<any>
  max(column: string): Promise<any>

  // ── Writes ───────────────────────────────────────────────────────────────
  insert(data: Record<string, any> | Record<string, any>[]): Promise<void>
  insertGetId(data: Record<string, any>): Promise<number>
  update(data: Record<string, any>): Promise<number>
  updateOrInsert(conditions: Record<string, any>, data: Record<string, any>): Promise<void>
  delete(): Promise<number>
  truncate(): Promise<void>

  // ── Pagination ───────────────────────────────────────────────────────────
  paginate(page?: number, perPage?: number): Promise<PaginationResult>

  // ── Utilities ────────────────────────────────────────────────────────────
  toSql(): string
  getBindings(): any[]
  clone(): QueryBuilder
}

type Operator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'not like' | 'in' | 'not in'
```

### 4.2 Raw Expressions

```typescript
/**
 * Wraps a raw SQL string so the query builder won't escape it.
 * @example db.table('orders').select(db.raw('COUNT(*) as count')).groupBy('status').get()
 */
function raw(expression: string, bindings?: any[]): Expression
```

### 4.3 Transactions

```typescript
// Automatic transaction (commit/rollback on success/error):
const result = await db.transaction(async (trx) => {
  await trx.table('accounts').where('id', 1).update({ balance: db.raw('balance - 100') })
  await trx.table('accounts').where('id', 2).update({ balance: db.raw('balance + 100') })
  return { success: true }
})

// Manual transaction:
const trx = await db.beginTransaction()
try {
  await trx.table('users').insert({ name: 'Alice' })
  await trx.commit()
} catch (err) {
  await trx.rollback()
  throw err
}
```

### 4.4 Pagination Result

```typescript
interface PaginationResult<T = Record<string, any>> {
  data: T[]
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  from: number    // first item index (1-based)
  to: number      // last item index
  hasMore: boolean
}
```

### 4.5 Global `db` Helper

```typescript
/**
 * Access the default database connection from anywhere.
 * @example db().table('users').where('active', true).get()
 * @example db('postgres').table('logs').insert({ ... })
 */
function db(connection?: string): DatabaseConnection
```

### 4.6 Behavior Notes

- Bindings are always parameterised — never string-interpolated. SQL injection is impossible through the query builder.
- Column names are quoted with the driver's appropriate quoting char (`` ` `` for MySQL, `"` for PostgreSQL/SQLite).
- `where(column, value)` is shorthand for `where(column, '=', value)`.
- Grouped wheres: `where(q => { q.where('a', 1).orWhere('b', 2) })` → `(a = 1 OR b = 2)`
- `paginate()` runs two queries: `COUNT(*)` to get total, then `LIMIT/OFFSET` for the page.

### 4.7 Tests

| Test | Description |
|------|-------------|
| `select-all` | `table('users').get()` → returns all rows |
| `select-columns` | `.select('id', 'name').get()` → only those columns |
| `where-equals` | `.where('active', true)` → correct WHERE clause |
| `where-operator` | `.where('age', '>', 18)` → uses operator |
| `where-in` | `.whereIn('id', [1,2,3])` → IN clause |
| `where-null` | `.whereNull('deleted_at')` → IS NULL |
| `grouped-where` | `.where(q => q.where('a', 1).orWhere('b', 2))` → grouped parens |
| `join` | `.join('posts', 'users.id', '=', 'posts.user_id')` → JOIN clause |
| `order-by` | `.orderBy('name', 'desc')` → ORDER BY |
| `limit-offset` | `.limit(10).offset(20)` → LIMIT/OFFSET |
| `count` | `.count()` → returns number |
| `insert` | `.insert({ name: 'Alice' })` → row inserted |
| `insert-get-id` | `.insertGetId({ name: 'Bob' })` → returns inserted ID |
| `update` | `.where('id', 1).update({ name: 'Updated' })` → 1 row affected |
| `delete` | `.where('id', 1).delete()` → row removed |
| `paginate` | `.paginate(1, 10)` → PaginationResult shape |
| `transaction-commit` | Callback succeeds → changes persist |
| `transaction-rollback` | Callback throws → no changes persist |
| `raw-expression` | `.select(raw('COUNT(*) as n'))` → raw in SQL |

---

## 5. Schema Builder

### 5.1 Interface

```typescript
interface SchemaBuilder {
  createTable(name: string, callback: (table: Blueprint) => void): Promise<void>
  dropTable(name: string): Promise<void>
  dropTableIfExists(name: string): Promise<void>
  renameTable(from: string, to: string): Promise<void>
  hasTable(name: string): Promise<boolean>
  hasColumn(table: string, column: string): Promise<boolean>
  alterTable(name: string, callback: (table: Blueprint) => void): Promise<void>
}
```

### 5.2 Blueprint (column definitions)

```typescript
interface Blueprint {
  // ── Primary key ──────────────────────────────────────────────────────────
  id(name?: string): ColumnDefinition                  // auto-increment integer PK
  uuid(name?: string): ColumnDefinition                // UUID PK

  // ── Numbers ──────────────────────────────────────────────────────────────
  integer(name: string): ColumnDefinition
  bigInteger(name: string): ColumnDefinition
  unsignedInteger(name: string): ColumnDefinition
  unsignedBigInteger(name: string): ColumnDefinition
  float(name: string, precision?: number): ColumnDefinition
  decimal(name: string, precision?: number, scale?: number): ColumnDefinition

  // ── Strings ───────────────────────────────────────────────────────────────
  string(name: string, length?: number): ColumnDefinition   // VARCHAR(255)
  text(name: string): ColumnDefinition
  longText(name: string): ColumnDefinition

  // ── Date/Time ────────────────────────────────────────────────────────────
  boolean(name: string): ColumnDefinition
  date(name: string): ColumnDefinition
  dateTime(name: string): ColumnDefinition
  timestamp(name: string): ColumnDefinition
  timestamps(): void                // adds created_at + updated_at (nullable timestamps)
  softDeletes(): void               // adds deleted_at (nullable timestamp)

  // ── Other ─────────────────────────────────────────────────────────────────
  json(name: string): ColumnDefinition
  jsonb(name: string): ColumnDefinition
  enum(name: string, values: string[]): ColumnDefinition

  // ── Indexes ──────────────────────────────────────────────────────────────
  index(columns: string | string[], name?: string): void
  unique(columns: string | string[], name?: string): void
  primary(columns: string[]): void
  foreign(column: string): ForeignKeyDefinition

  // ── Alter-table only ─────────────────────────────────────────────────────
  dropColumn(name: string): void
  renameColumn(from: string, to: string): void
}

interface ColumnDefinition {
  nullable(): this
  default(value: any): this
  unique(): this
  index(): this
  unsigned(): this
  after(column: string): this    // MySQL only: column position
  comment(text: string): this
  references(column: string): ForeignKeyDefinition
}

interface ForeignKeyDefinition {
  on(table: string): this
  onDelete(action: 'cascade' | 'set null' | 'restrict' | 'no action'): this
  onUpdate(action: 'cascade' | 'set null' | 'restrict' | 'no action'): this
}
```

---

## 6. Migrations

### 6.1 Migration File Format

Files are stored in `database/migrations/` with a timestamp prefix:

```
database/migrations/
  2026_03_18_000001_create_users_table.ts
  2026_03_18_000002_create_posts_table.ts
```

```typescript
// 2026_03_18_000001_create_users_table.ts
import type { SchemaBuilder } from '@mantiq/database'

export const up = async (schema: SchemaBuilder): Promise<void> => {
  await schema.createTable('users', (t) => {
    t.id()
    t.string('name')
    t.string('email').unique()
    t.string('password')
    t.boolean('is_active').default(true)
    t.timestamps()
  })
}

export const down = async (schema: SchemaBuilder): Promise<void> => {
  await schema.dropTableIfExists('users')
}
```

### 6.2 Migrator

```typescript
class Migrator {
  /**
   * Run all pending migrations.
   */
  async up(): Promise<string[]>          // returns list of migration names run

  /**
   * Roll back the last batch.
   */
  async down(steps?: number): Promise<string[]>

  /**
   * Get migration status: pending, ran, batch number.
   */
  async status(): Promise<MigrationStatus[]>

  /**
   * Drop all tables and re-run all migrations from scratch.
   */
  async fresh(): Promise<void>

  /**
   * Roll back all migrations.
   */
  async reset(): Promise<void>
}

interface MigrationStatus {
  name: string
  ran: boolean
  batch: number | null
}
```

The `migrations` table schema:
```sql
CREATE TABLE migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  migration TEXT NOT NULL,
  batch     INTEGER NOT NULL
)
```

---

## 7. ORM — Model

### 7.1 Model Definition

```typescript
class User extends Model {
  static table = 'users'
  static primaryKey = 'id'         // default
  static timestamps = true         // default: manages created_at / updated_at
  static softDeletes = false       // default

  // Column → type casts
  static casts: Record<string, CastType> = {
    is_active: 'boolean',
    metadata: 'json',
    created_at: 'date',
  }

  // Allowed for mass assignment
  static fillable: string[] = ['name', 'email', 'password']

  // Never allowed for mass assignment
  static guarded: string[] = ['id']

  // Excluded from toJSON()
  static hidden: string[] = ['password']
}

type CastType = 'string' | 'number' | 'boolean' | 'json' | 'date' | 'datetime'
```

### 7.2 Static Query Methods

```typescript
// All return ModelQueryBuilder (extends QueryBuilder, returns model instances)
User.query()                              // start a query
User.all()                                // SELECT * FROM users
User.find(1)                              // find by PK → User | null
User.findOrFail(1)                        // → User, throws ModelNotFoundError if not found
User.where('active', true).get()          // WHERE active = 1
User.where('age', '>', 18).first()
User.whereIn('id', [1,2,3]).get()
User.with('posts', 'profile').get()       // eager load relationships
User.paginate(1, 15)                      // → PaginationResult<User>

// Scopes: static scopeName(query) → applied as User.scopeName()
class User extends Model {
  static scopeActive(query: ModelQueryBuilder) {
    return query.where('is_active', true)
  }
}
User.active().get()  // → active users
```

### 7.3 Model Instance Methods

```typescript
// Create
const user = new User({ name: 'Alice', email: 'alice@example.com' })
await user.save()                    // INSERT
user.id                              // now populated

// Static create shorthand
const user = await User.create({ name: 'Alice', email: 'alice@example.com' })

// Update
user.name = 'Alice Smith'
await user.save()                    // UPDATE WHERE id = user.id

// Static update shorthand
await User.where('id', 1).update({ name: 'Updated' })

// Delete
await user.delete()                  // DELETE WHERE id = user.id (or sets deleted_at if softDeletes)

// Refresh from database
await user.fresh()                   // re-fetches from DB, updates instance

// Serialisation
user.toObject()                      // plain object (respects hidden, applies casts)
user.toJSON()                        // JSON string (respects hidden)
```

### 7.4 Soft Deletes

When `static softDeletes = true`:
- `delete()` sets `deleted_at = NOW()` instead of deleting the row
- All queries automatically add `WHERE deleted_at IS NULL`
- `User.withTrashed().get()` — includes soft-deleted records
- `User.onlyTrashed().get()` — only soft-deleted records
- `await user.restore()` — sets `deleted_at = NULL`
- `await user.forceDelete()` — permanently deletes

### 7.5 Casts

Casts are applied when reading from the database (query results) and when writing (before insert/update).

| Cast | DB read → JS | JS write → DB |
|------|-------------|--------------|
| `'boolean'` | `1/0` → `true/false` | `true/false` → `1/0` |
| `'json'` | JSON string → parsed object | object → `JSON.stringify()` |
| `'date'` | string → `Date` | `Date` → ISO string |
| `'number'` | string → `Number()` | number → number |
| `'string'` | any → `String()` | any → string |

---

## 8. Relationships

### 8.1 Definition

Relationships are defined as instance methods on the model that return a relation object:

```typescript
class User extends Model {
  profile() {
    return this.hasOne(Profile, 'user_id')
  }

  posts() {
    return this.hasMany(Post, 'user_id')
  }

  roles() {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id')
  }
}

class Post extends Model {
  author() {
    return this.belongsTo(User, 'user_id')
  }

  comments() {
    return this.hasMany(Comment, 'post_id')
  }
}
```

### 8.2 Contracts

```typescript
// hasOne(relatedModel, foreignKey, localKey?)
// Returns a single related model or null
this.hasOne(Profile, 'user_id')        // Profile.where('user_id', this.id).first()

// hasMany(relatedModel, foreignKey, localKey?)
// Returns array of related models
this.hasMany(Post, 'user_id')          // Post.where('user_id', this.id).get()

// belongsTo(relatedModel, foreignKey, ownerKey?)
// Returns single related model (the owner)
this.belongsTo(User, 'user_id')        // User.find(this.user_id)

// belongsToMany(relatedModel, pivotTable, foreignKey, relatedKey)
// Returns array via pivot table
this.belongsToMany(Role, 'role_user', 'user_id', 'role_id')
```

### 8.3 Eager Loading

```typescript
// Load with relationships
const users = await User.with('posts', 'profile').get()
// users[0].posts → Post[] (already loaded, no extra query)
// users[0].profile → Profile | null

// Nested eager loading (dot-notation)
const users = await User.with('posts.comments').get()
// users[0].posts[0].comments → Comment[]

// Constrained eager loading
const users = await User.with({
  posts: (query) => query.where('published', true).orderBy('created_at', 'desc')
}).get()
```

**N+1 prevention:** `with()` uses two queries regardless of result set size:
1. `SELECT * FROM users WHERE ...`
2. `SELECT * FROM posts WHERE user_id IN (1, 2, 3, ...)`

Then matches in memory.

### 8.4 Pivot Table (belongsToMany)

```typescript
// Attach roles to a user
await user.roles().attach(roleId)
await user.roles().attach([1, 2, 3])
await user.roles().attach(roleId, { granted_at: new Date() })  // with pivot data

// Detach
await user.roles().detach(roleId)
await user.roles().detach()           // detach all

// Sync (replaces current associations)
await user.roles().sync([1, 2, 3])

// Access pivot data
const roles = await user.roles().get()
roles[0].pivot.granted_at             // pivot column
```

### 8.5 Tests

| Test | Description |
|------|-------------|
| `hasOne-load` | `user.profile()` loads related profile |
| `hasMany-load` | `user.posts()` loads array of posts |
| `belongsTo-load` | `post.author()` loads owner user |
| `belongsToMany-load` | `user.roles()` loads via pivot |
| `eager-hasMany` | `User.with('posts').get()` → each user has posts array |
| `eager-nested` | `User.with('posts.comments').get()` → nested loaded |
| `eager-constrained` | `User.with({ posts: q => q.where('published', true) })` |
| `pivot-attach` | `user.roles().attach(1)` → row in pivot |
| `pivot-detach` | `user.roles().detach(1)` → row removed |
| `pivot-sync` | `user.roles().sync([1,2])` → only 1 and 2 remain |

---

## 9. Seeders and Factories

### 9.1 Seeder

```typescript
// database/seeders/DatabaseSeeder.ts
import { Seeder, db } from '@mantiq/database'
import { UserSeeder } from './UserSeeder.ts'

export class DatabaseSeeder extends Seeder {
  async run(): Promise<void> {
    await this.call(UserSeeder)
  }
}

// database/seeders/UserSeeder.ts
export class UserSeeder extends Seeder {
  async run(): Promise<void> {
    await db().table('users').insert([
      { name: 'Alice', email: 'alice@example.com', password: 'hashed' },
      { name: 'Bob',   email: 'bob@example.com',   password: 'hashed' },
    ])
  }
}
```

```typescript
abstract class Seeder {
  abstract run(): Promise<void>
  async call(SeederClass: Constructor<Seeder>): Promise<void>
}
```

### 9.2 Factory

```typescript
// database/factories/UserFactory.ts
import { Factory } from '@mantiq/database'
import { User } from '../../app/Models/User.ts'

export class UserFactory extends Factory<User> {
  model = User

  define() {
    return {
      name:  `User ${Math.random().toString(36).slice(2, 8)}`,
      email: `user_${Date.now()}@example.com`,
      password: 'password',
      is_active: true,
    }
  }
}

// Usage
const user  = await UserFactory.create()              // INSERT + return model
const users = await UserFactory.createMany(10)        // 10 rows
const stub  = UserFactory.make()                      // model instance, not saved
const stub  = UserFactory.make({ name: 'Override' }) // with attribute overrides
```

```typescript
abstract class Factory<T extends Model> {
  abstract model: Constructor<T>
  abstract define(): Partial<Record<string, any>>

  make(overrides?: Partial<Record<string, any>>): T
  create(overrides?: Partial<Record<string, any>>): Promise<T>
  createMany(count: number, overrides?: Partial<Record<string, any>>): Promise<T[]>
  makeMany(count: number, overrides?: Partial<Record<string, any>>): T[]
}
```

---

## 10. Errors

```typescript
class QueryError extends MantiqError {
  constructor(
    public readonly sql: string,
    public readonly bindings: any[],
    public readonly originalError: Error,
  ) {
    super(`Database query failed: ${originalError.message}`, { sql, bindings })
  }
}

class ModelNotFoundError extends MantiqError {
  constructor(
    public readonly modelName: string,
    public readonly id?: any,
  ) {
    super(
      id
        ? `No ${modelName} found with ID ${id}.`
        : `No ${modelName} matching the given conditions.`
    )
  }
}

class ConnectionError extends MantiqError {
  constructor(
    public readonly driver: string,
    originalError: Error,
  ) {
    super(`Failed to connect to ${driver} database: ${originalError.message}`)
  }
}
```

---

## 11. DatabaseServiceProvider

```typescript
class DatabaseServiceProvider extends ServiceProvider {
  register(): void {
    // Register the connection manager
    this.app.singleton(DatabaseManager, (c) => {
      const config = c.make(ConfigRepository)
      return new DatabaseManager(config)
    })

    // Bind connection interface
    this.app.singleton(DatabaseConnection, (c) => {
      return c.make(DatabaseManager).connection()
    })

    // Register Schema builder (resolved from default connection)
    this.app.bind(SchemaBuilder, (c) => {
      return c.make(DatabaseConnection).schema()
    })
  }

  async boot(): Promise<void> {
    // Verify the default connection can connect (fail fast)
    // Only in non-production or when DB_VERIFY_CONNECTION=true
    const config = this.app.make(ConfigRepository)
    if (config.get('app.env', 'production') !== 'production') {
      try {
        const db = this.app.make(DatabaseManager)
        await db.connection().select('SELECT 1')
      } catch (err) {
        console.warn('[Database] Could not verify connection:', err)
      }
    }
  }
}
```

---

## 12. Global `db()` Helper

```typescript
/**
 * Access a database connection from anywhere.
 * Without arguments, returns the default connection.
 *
 * @example db().table('users').get()
 * @example db('postgres').table('logs').insert({ ... })
 * @example await db().transaction(async (trx) => { ... })
 */
function db(connection?: string): DatabaseConnection
```

Implemented by resolving `DatabaseManager` from `Application.getInstance()`.

---

## 13. Model Tests

| Test | Description |
|------|-------------|
| `create-and-find` | `User.create({ name })` → `User.find(id)` returns it |
| `findOrFail-throws` | `User.findOrFail(9999)` throws `ModelNotFoundError` |
| `save-insert` | `new User({ name }).save()` → row in DB |
| `save-update` | Modify property, `save()` → DB updated |
| `delete` | `user.delete()` → row gone |
| `soft-delete` | `softDeletes=true`, `delete()` sets `deleted_at` |
| `soft-delete-filter` | Soft-deleted rows excluded from `all()` |
| `withTrashed` | `withTrashed()` includes soft-deleted rows |
| `restore` | `user.restore()` clears `deleted_at` |
| `cast-boolean` | DB stores `1`, model returns `true` |
| `cast-json` | DB stores string, model returns object |
| `hidden` | `password` excluded from `toJSON()` |
| `fillable` | Mass assignment respects `fillable` |
| `scope` | `User.active()` adds WHERE clause |
| `paginate` | Returns correct `PaginationResult` shape |
| `timestamps` | `created_at`/`updated_at` set automatically |

---

## 14. Exports

`packages/database/src/index.ts`:

```typescript
// Contracts
export type { DatabaseConnection } from './contracts/Connection.ts'
export type { QueryBuilder, PaginationResult } from './contracts/QueryBuilder.ts'
export type { SchemaBuilder } from './contracts/SchemaBuilder.ts'
export type { Blueprint, ColumnDefinition, ForeignKeyDefinition } from './contracts/Blueprint.ts'

// ORM
export { Model } from './orm/Model.ts'
export { Collection } from './orm/Collection.ts'

// Schema / Migrations
export { Migrator } from './migrations/Migrator.ts'

// Seeders / Factories
export { Seeder } from './seeders/Seeder.ts'
export { Factory } from './factories/Factory.ts'

// Errors
export { QueryError } from './errors/QueryError.ts'
export { ModelNotFoundError } from './errors/ModelNotFoundError.ts'
export { ConnectionError } from './errors/ConnectionError.ts'

// Provider
export { DatabaseServiceProvider } from './providers/DatabaseServiceProvider.ts'

// Global helpers
export { db } from './helpers/db.ts'
export { raw } from './query/Expression.ts'
```

---

*This spec is the implementation contract for `@mantiq/database`. An AI builder should be able to implement this package from this document alone.*
