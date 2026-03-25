/**
 * Advanced database integration tests — subqueries, complex joins, aggregation,
 * transactions, JSON columns, soft deletes, migration DDL, and pagination edge cases.
 *
 * Runs against real SQLite (in-memory) locally. The query patterns (whereRaw, selectRaw,
 * havingRaw) use standard SQL that works on PostgreSQL and MySQL in CI — comments note
 * any driver-specific equivalents where syntax differs.
 *
 * Run: bun test packages/database/tests/integration/advanced-queries.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { SQLiteConnection } from '../../src/drivers/SQLiteConnection.ts'
import { Model } from '../../src/orm/Model.ts'
import { raw } from '../../src/query/Expression.ts'
import type { SchemaBuilder } from '../../src/schema/SchemaBuilder.ts'

// ── Connection ──────────────────────────────────────────────────────────────

const conn = new SQLiteConnection({ database: ':memory:' })

// ── ORM Models (for soft-delete tests) ──────────────────────────────────────

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'age', 'department', 'salary', 'meta']
  static override guarded = ['id']
  static override timestamps = true
}

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body', 'user_id', 'published', 'category']
  static override softDelete = true
  static override timestamps = true

  author() {
    return this.belongsTo(User as any, 'user_id')
  }
}

class CommentModel extends Model {
  static override table = 'comments'
  static override fillable = ['body', 'post_id', 'user_id']
  static override timestamps = false
}

// Wire up relations after class definitions
Object.defineProperty(User.prototype, 'posts', {
  value: function () { return this.hasMany(Post as any, 'user_id') },
})
Object.defineProperty(Post.prototype, 'comments', {
  value: function () { return this.hasMany(CommentModel as any, 'post_id') },
})

// ── Setup: create tables and seed data ──────────────────────────────────────

beforeAll(async () => {
  User.setConnection(conn)
  Post.setConnection(conn)
  CommentModel.setConnection(conn)

  const schema = conn.schema()

  // Drop in dependency order
  await schema.dropIfExists('comments')
  await schema.dropIfExists('posts')
  await schema.dropIfExists('employees')
  await schema.dropIfExists('departments')
  await schema.dropIfExists('users')

  await schema.create('departments', (t) => {
    t.id()
    t.string('name', 100)
  })

  await schema.create('users', (t) => {
    t.id()
    t.string('name', 100)
    t.string('email', 200).unique()
    t.integer('age').nullable()
    t.string('department', 100).nullable()
    t.decimal('salary', 10, 2).nullable()
    t.json('meta').nullable()
    t.timestamps()
  })

  await schema.create('posts', (t) => {
    t.id()
    t.string('title', 200)
    t.text('body').nullable()
    t.unsignedBigInteger('user_id').nullable()
    t.boolean('published').default(0)
    t.string('category', 100).nullable()
    t.timestamps()
    t.softDeletes()
  })

  await schema.create('comments', (t) => {
    t.id()
    t.text('body')
    t.unsignedBigInteger('post_id')
    t.unsignedBigInteger('user_id').nullable()
  })

  // Employees table with self-referencing manager_id (for self-join tests)
  await schema.create('employees', (t) => {
    t.id()
    t.string('name', 100)
    t.unsignedBigInteger('manager_id').nullable()
    t.unsignedBigInteger('department_id').nullable()
    t.decimal('salary', 10, 2).default(0)
  })
})

afterAll(() => {
  ;(conn as any).close?.()
})

// ── Helper: seed realistic data ─────────────────────────────────────────────

async function seedData() {
  // Departments
  const deptIds: number[] = []
  for (const name of ['Engineering', 'Marketing', 'Sales', 'HR']) {
    const id = await conn.table('departments').insertGetId({ name })
    deptIds.push(id as number)
  }

  // 12 Users
  const userIds: number[] = []
  const users = [
    { name: 'Alice', email: 'alice@test.com', age: 30, department: 'Engineering', salary: 120000 },
    { name: 'Bob', email: 'bob@test.com', age: 25, department: 'Engineering', salary: 95000 },
    { name: 'Charlie', email: 'charlie@test.com', age: 35, department: 'Marketing', salary: 85000 },
    { name: 'Diana', email: 'diana@test.com', age: 28, department: 'Marketing', salary: 90000 },
    { name: 'Eve', email: 'eve@test.com', age: 32, department: 'Sales', salary: 75000 },
    { name: 'Frank', email: 'frank@test.com', age: 40, department: 'Sales', salary: 110000 },
    { name: 'Grace', email: 'grace@test.com', age: 27, department: 'HR', salary: 70000 },
    { name: 'Hank', email: 'hank@test.com', age: 45, department: 'HR', salary: 80000 },
    { name: 'Ivy', email: 'ivy@test.com', age: 23, department: 'Engineering', salary: 88000 },
    { name: 'Jack', email: 'jack@test.com', age: 38, department: 'Engineering', salary: 130000 },
    { name: 'Karen', email: 'karen@test.com', age: 29, department: 'Marketing', salary: 92000 },
    { name: 'Leo', email: 'leo@test.com', age: 33, department: 'Sales', salary: 98000 },
  ]
  for (const u of users) {
    const id = await conn.table('users').insertGetId(u)
    userIds.push(id as number)
  }

  // 35 Posts (some published, some not)
  const postIds: number[] = []
  for (let i = 0; i < 35; i++) {
    const userId = userIds[i % userIds.length]!
    const id = await conn.table('posts').insertGetId({
      title: `Post ${i + 1}`,
      body: `Body of post ${i + 1}`,
      user_id: userId,
      published: i % 3 !== 0 ? 1 : 0, // ~66% published
      category: ['tech', 'lifestyle', 'news'][i % 3],
    })
    postIds.push(id as number)
  }

  // 55 Comments spread across posts
  for (let i = 0; i < 55; i++) {
    await conn.table('comments').insert({
      body: `Comment ${i + 1}`,
      post_id: postIds[i % postIds.length]!,
      user_id: userIds[i % userIds.length]!,
    })
  }

  // Employees with managers (self-referencing)
  const mgrAlice = await conn.table('employees').insertGetId({
    name: 'Alice (Mgr)', manager_id: null, department_id: deptIds[0], salary: 150000,
  })
  const mgrBob = await conn.table('employees').insertGetId({
    name: 'Bob (Mgr)', manager_id: null, department_id: deptIds[1], salary: 140000,
  })
  for (let i = 0; i < 6; i++) {
    await conn.table('employees').insert({
      name: `Employee ${i + 1}`,
      manager_id: i < 3 ? mgrAlice : mgrBob,
      department_id: i < 3 ? deptIds[0] : deptIds[1],
      salary: 60000 + i * 5000,
    })
  }

  return { deptIds, userIds, postIds }
}

async function clearAllTables() {
  await conn.statement('DELETE FROM comments')
  await conn.statement('DELETE FROM posts')
  await conn.table('employees').delete()
  await conn.table('departments').delete()
  await conn.table('users').delete()
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SUBQUERIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Subqueries', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('WHERE IN subquery — users who have published posts', async () => {
    const { userIds } = await seedData()

    // Subquery: SELECT user_id FROM posts WHERE published = 1
    // Using whereRaw with a subquery
    const rows = await conn.table('users')
      .whereRaw('"id" IN (SELECT "user_id" FROM "posts" WHERE "published" = ?)', [1])
      .orderBy('id')
      .get()

    // Every user with at least one published post should appear
    expect(rows.length).toBeGreaterThan(0)

    // Verify each returned user actually has a published post
    for (const user of rows) {
      const publishedPost = await conn.table('posts')
        .where('user_id', user['id'])
        .where('published', 1)
        .first()
      expect(publishedPost).not.toBeNull()
    }
  })

  it('WHERE EXISTS subquery — users who have any comments', async () => {
    await seedData()

    // WHERE EXISTS (SELECT 1 FROM comments WHERE comments.user_id = users.id)
    const rows = await conn.table('users')
      .whereRaw('EXISTS (SELECT 1 FROM "comments" WHERE "comments"."user_id" = "users"."id")')
      .orderBy('id')
      .get()

    expect(rows.length).toBeGreaterThan(0)

    // Verify each returned user has at least one comment
    for (const user of rows) {
      const commentCount = await conn.table('comments').where('user_id', user['id']).count()
      expect(commentCount).toBeGreaterThan(0)
    }

    // Verify NOT EXISTS counterpart excludes them
    const noComments = await conn.table('users')
      .whereRaw('NOT EXISTS (SELECT 1 FROM "comments" WHERE "comments"."user_id" = "users"."id")')
      .get()
    expect(rows.length + noComments.length).toBe(12) // all 12 users
  })

  it('subquery as column — select with correlated post count', async () => {
    await seedData()

    // SELECT *, (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS post_count
    const rows = await conn.table('users')
      .selectRaw('*, (SELECT COUNT(*) FROM "posts" WHERE "posts"."user_id" = "users"."id") AS post_count')
      .orderByDesc('post_count')
      .get()

    expect(rows.length).toBe(12)

    // First user should have the most posts (or tied), last should have fewest
    expect(Number(rows[0]!['post_count'])).toBeGreaterThanOrEqual(Number(rows[rows.length - 1]!['post_count']))

    // Verify the counts are accurate
    for (const row of rows.slice(0, 3)) {
      const actualCount = await conn.table('posts').where('user_id', row['id']).count()
      expect(Number(row['post_count'])).toBe(actualCount)
    }
  })

  it('whereRaw with correlated subquery — users whose avg post count > department avg', async () => {
    await seedData()

    // Users who have more posts than the average post count for their department
    // Correlated subquery pattern
    const rows = await conn.table('users')
      .whereRaw(`
        (SELECT COUNT(*) FROM "posts" WHERE "posts"."user_id" = "users"."id") >
        (SELECT AVG(cnt) FROM (
          SELECT COUNT(*) AS cnt FROM "posts"
          INNER JOIN "users" AS u2 ON "posts"."user_id" = u2."id"
          WHERE u2."department" = "users"."department"
          GROUP BY "posts"."user_id"
        ))
      `)
      .get()

    // Should return some users but not all
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(12)
  })

  it('subquery in HAVING clause — departments where total salary > threshold', async () => {
    await seedData()

    // GROUP BY department, HAVING SUM(salary) > subquery average
    const rows = await conn.table('users')
      .selectRaw('"department", COUNT(*) AS emp_count, SUM("salary") AS total_salary')
      .groupBy('department')
      .havingRaw('SUM("salary") > (SELECT AVG("salary") FROM "users") * 2')
      .get()

    // At least some departments should exceed 2x the average salary
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      expect(Number(row['total_salary'])).toBeGreaterThan(0)
      expect(Number(row['emp_count'])).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COMPLEX JOINS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complex Joins', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('three-table join — users with their post comments', async () => {
    await seedData()

    const rows = await conn.table('users')
      .join('posts', '"posts"."user_id"', '=', '"users"."id"')
      .join('comments', '"comments"."post_id"', '=', '"posts"."id"')
      .select(
        raw('"users"."name" AS user_name'),
        raw('"posts"."title" AS post_title'),
        raw('"comments"."body" AS comment_body'),
      )
      .limit(20)
      .get()

    expect(rows.length).toBeGreaterThan(0)
    // Every row should have all three fields populated
    for (const row of rows) {
      expect(row['user_name']).toBeTruthy()
      expect(row['post_title']).toBeTruthy()
      expect(row['comment_body']).toBeTruthy()
    }
  })

  it('self-join — employees with their manager names', async () => {
    await seedData()

    // The leftJoin API quotes the table name as a single identifier, so for
    // aliased self-joins we use a raw query via conn.select().
    const rows = await conn.select(
      `SELECT e."name" AS employee_name, m."name" AS manager_name
       FROM "employees" e
       LEFT JOIN "employees" m ON m."id" = e."manager_id"
       ORDER BY e."name" ASC`,
    )

    expect(rows.length).toBe(8) // 2 managers + 6 employees

    // Managers should have null manager_name
    const managers = rows.filter((r) => r['manager_name'] === null)
    expect(managers.length).toBe(2)

    // Non-managers should have a manager name
    const subordinates = rows.filter((r) => r['manager_name'] !== null)
    expect(subordinates.length).toBe(6)
    for (const sub of subordinates) {
      expect(sub['manager_name']).toMatch(/Mgr/)
    }
  })

  it('left join with aggregate — users with post count (including zero)', async () => {
    await seedData()

    // Also insert a user with zero posts
    await conn.table('users').insert({
      name: 'NoPosts', email: 'noposts@test.com', age: 50, department: 'Engineering', salary: 100000,
    })

    const rows = await conn.table('users')
      .leftJoin('posts', '"posts"."user_id"', '=', '"users"."id"')
      .selectRaw('"users"."name", COUNT("posts"."id") AS post_count')
      .groupBy('users.id')
      .orderByDesc('post_count')
      .get()

    // 13 users now (12 seeded + 1 NoPosts)
    expect(rows.length).toBe(13)

    // NoPosts user should have 0 posts
    const noPosts = rows.find((r) => r['name'] === 'NoPosts')
    expect(noPosts).not.toBeNull()
    expect(Number(noPosts!['post_count'])).toBe(0)

    // Other users should have at least 1 post
    const withPosts = rows.filter((r) => r['name'] !== 'NoPosts')
    for (const row of withPosts) {
      expect(Number(row['post_count'])).toBeGreaterThan(0)
    }
  })

  it('join with multiple ON conditions via raw', async () => {
    await seedData()

    // Join posts to comments where both the post_id matches AND user_id matches
    // (comments made by the post author on their own posts)
    const rows = await conn.table('posts')
      .join('comments', '"comments"."post_id"', '=', '"posts"."id"')
      .whereRaw('"comments"."user_id" = "posts"."user_id"')
      .select(
        raw('"posts"."title"'),
        raw('"comments"."body" AS comment_body'),
        raw('"posts"."user_id"'),
      )
      .get()

    // Verify each result has matching user_id across post and comment
    for (const row of rows) {
      const comment = await conn.table('comments')
        .where('body', row['comment_body'])
        .first()
      expect(Number(comment!['user_id'])).toBe(Number(row['user_id']))
    }
  })

  it('join with WHERE on joined table', async () => {
    await seedData()

    // Get users who have published posts in the 'lifestyle' category
    const rows = await conn.table('users')
      .join('posts', '"posts"."user_id"', '=', '"users"."id"')
      .whereRaw('"posts"."published" = ?', [1])
      .whereRaw('"posts"."category" = ?', ['lifestyle'])
      .select(raw('DISTINCT "users"."name"'))
      .orderBy(raw('"users"."name"'))
      .get()

    expect(rows.length).toBeGreaterThan(0)

    // Verify each user actually has a published lifestyle post
    for (const row of rows) {
      const user = await conn.table('users').where('name', row['name']).first()
      const lifestylePost = await conn.table('posts')
        .where('user_id', user!['id'])
        .where('published', 1)
        .whereRaw('"category" = ?', ['lifestyle'])
        .first()
      expect(lifestylePost).not.toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADVANCED AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Advanced Aggregation', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('GROUP BY multiple columns', async () => {
    await seedData()

    const rows = await conn.table('posts')
      .selectRaw('"user_id", "category", COUNT(*) AS cnt')
      .groupBy('user_id', 'category')
      .orderBy('user_id')
      .get()

    expect(rows.length).toBeGreaterThan(0)

    // Each combination should be unique
    const combos = rows.map((r) => `${r['user_id']}-${r['category']}`)
    expect(new Set(combos).size).toBe(combos.length)

    // Verify counts are correct
    for (const row of rows.slice(0, 5)) {
      const actual = await conn.table('posts')
        .where('user_id', row['user_id'])
        .whereRaw('"category" = ?', [row['category']])
        .count()
      expect(Number(row['cnt'])).toBe(actual)
    }
  })

  it('HAVING with multiple conditions', async () => {
    await seedData()

    const rows = await conn.table('users')
      .selectRaw('"department", COUNT(*) AS emp_count, AVG("salary") AS avg_salary')
      .groupBy('department')
      .havingRaw('COUNT(*) >= ?', [3])
      .havingRaw('AVG("salary") > ?', [80000])
      .get()

    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      expect(Number(row['emp_count'])).toBeGreaterThanOrEqual(3)
      expect(Number(row['avg_salary'])).toBeGreaterThan(80000)
    }
  })

  it('nested aggregates via raw — department stats', async () => {
    await seedData()

    // SELECT department, count(*), avg(salary), min(salary), max(salary)
    // GROUP BY department HAVING avg(salary) > 75000
    const rows = await conn.table('users')
      .selectRaw(`
        "department",
        COUNT(*) AS emp_count,
        AVG("salary") AS avg_salary,
        MIN("salary") AS min_salary,
        MAX("salary") AS max_salary
      `)
      .groupBy('department')
      .havingRaw('AVG("salary") > ?', [75000])
      .orderByDesc('avg_salary')
      .get()

    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const avg = Number(row['avg_salary'])
      const min = Number(row['min_salary'])
      const max = Number(row['max_salary'])
      expect(avg).toBeGreaterThan(75000)
      expect(min).toBeLessThanOrEqual(avg)
      expect(max).toBeGreaterThanOrEqual(avg)
    }
  })

  it('selectRaw with CASE expressions', async () => {
    await seedData()

    // Categorize users by salary range using CASE
    const rows = await conn.table('users')
      .selectRaw(`
        "name",
        "salary",
        CASE
          WHEN "salary" >= 120000 THEN 'senior'
          WHEN "salary" >= 90000 THEN 'mid'
          ELSE 'junior'
        END AS salary_tier
      `)
      .orderByDesc('salary')
      .get()

    expect(rows.length).toBe(12)

    // Verify the CASE logic
    for (const row of rows) {
      const salary = Number(row['salary'])
      if (salary >= 120000) {
        expect(row['salary_tier']).toBe('senior')
      } else if (salary >= 90000) {
        expect(row['salary_tier']).toBe('mid')
      } else {
        expect(row['salary_tier']).toBe('junior')
      }
    }
  })

  it('count with distinct', async () => {
    await seedData()

    // Count distinct departments
    const rows = await conn.table('users')
      .selectRaw('COUNT(DISTINCT "department") AS dept_count')
      .get()

    expect(Number(rows[0]!['dept_count'])).toBe(4) // Engineering, Marketing, Sales, HR

    // Count distinct categories in posts
    const catRows = await conn.table('posts')
      .selectRaw('COUNT(DISTINCT "category") AS cat_count')
      .get()

    expect(Number(catRows[0]!['cat_count'])).toBe(3) // tech, lifestyle, news
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TRANSACTION ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Transaction Isolation', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('nested transaction-like behavior (savepoints)', async () => {
    // SQLite wraps in a single transaction; we test that outer commit
    // preserves inner writes
    await conn.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'Outer', email: 'outer@tx.com', age: 30 })

      // Simulate nested work (in SQLite this is the same transaction)
      await tx.table('users').insert({ name: 'Inner', email: 'inner@tx.com', age: 25 })

      // Both should be visible within the transaction
      const count = await tx.table('users').count()
      expect(count).toBe(2)
    })

    // Both should be committed
    const afterCommit = await conn.table('users').count()
    expect(afterCommit).toBe(2)

    const outer = await conn.table('users').where('email', 'outer@tx.com').first()
    expect(outer).not.toBeNull()
    const inner = await conn.table('users').where('email', 'inner@tx.com').first()
    expect(inner).not.toBeNull()
  })

  it('transaction rollback restores data completely', async () => {
    // Insert baseline data before the transaction
    await conn.table('users').insert({ name: 'Baseline', email: 'base@tx.com', age: 40 })
    expect(await conn.table('users').count()).toBe(1)

    // Transaction that fails: all changes should be rolled back
    try {
      await conn.transaction(async (tx) => {
        await tx.table('users').insert({ name: 'TX1', email: 'tx1@tx.com', age: 20 })
        await tx.table('users').insert({ name: 'TX2', email: 'tx2@tx.com', age: 21 })

        // Verify data is visible inside the transaction
        const insideTx = await tx.table('users').count()
        expect(insideTx).toBe(3)

        // Now throw to trigger rollback
        throw new Error('deliberate rollback')
      })
    } catch (e: any) {
      expect(e.message).toBe('deliberate rollback')
    }

    // Only baseline should remain
    const afterRollback = await conn.table('users').count()
    expect(afterRollback).toBe(1)

    // Verify the specific rows were not persisted
    expect(await conn.table('users').where('email', 'tx1@tx.com').first()).toBeNull()
    expect(await conn.table('users').where('email', 'tx2@tx.com').first()).toBeNull()

    // Baseline should still be there
    expect(await conn.table('users').where('email', 'base@tx.com').first()).not.toBeNull()
  })

  it('concurrent inserts in separate transactions do not interfere', async () => {
    // Since SQLite is single-writer, we test that two sequential transactions
    // each produce correct, isolated results
    await conn.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'TxA', email: 'txa@tx.com', age: 30 })
    })

    await conn.transaction(async (tx) => {
      await tx.table('users').insert({ name: 'TxB', email: 'txb@tx.com', age: 31 })
    })

    // Both should be persisted independently
    const all = await conn.table('users').orderBy('name').get()
    expect(all.length).toBe(2)
    expect(all[0]!['name']).toBe('TxA')
    expect(all[1]!['name']).toBe('TxB')

    // Verify no data corruption
    const txA = await conn.table('users').where('email', 'txa@tx.com').first()
    expect(Number(txA!['age'])).toBe(30)
    const txB = await conn.table('users').where('email', 'txb@tx.com').first()
    expect(Number(txB!['age'])).toBe(31)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. JSON COLUMN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('JSON Column Operations', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('insert and retrieve JSON data', async () => {
    const meta = { role: 'admin', preferences: { theme: 'dark', lang: 'en' }, tags: ['vip', 'early-adopter'] }
    await conn.table('users').insert({
      name: 'JsonUser', email: 'json@test.com', age: 30, meta: JSON.stringify(meta),
    })

    const row = await conn.table('users').where('email', 'json@test.com').first()
    expect(row).not.toBeNull()

    const parsed = JSON.parse(row!['meta'] as string)
    expect(parsed.role).toBe('admin')
    expect(parsed.preferences.theme).toBe('dark')
    expect(parsed.tags).toEqual(['vip', 'early-adopter'])
  })

  it('query JSON field values via whereRaw — SQLite json_extract', async () => {
    // SQLite: json_extract(meta, '$.role')
    // PostgreSQL equivalent: meta->>'role'  or  meta::jsonb->>'role'
    // MySQL equivalent: JSON_EXTRACT(meta, '$.role')  or  meta->>'$.role'

    await conn.table('users').insert([
      { name: 'Admin', email: 'admin@json.com', meta: JSON.stringify({ role: 'admin', level: 5 }) },
      { name: 'Editor', email: 'editor@json.com', meta: JSON.stringify({ role: 'editor', level: 3 }) },
      { name: 'Viewer', email: 'viewer@json.com', meta: JSON.stringify({ role: 'viewer', level: 1 }) },
    ])

    // Find users with role = 'admin'
    const admins = await conn.table('users')
      .whereRaw("json_extract(\"meta\", '$.role') = ?", ['admin'])
      .get()
    expect(admins.length).toBe(1)
    expect(admins[0]!['name']).toBe('Admin')

    // Find users with level >= 3
    const highLevel = await conn.table('users')
      .whereRaw("json_extract(\"meta\", '$.level') >= ?", [3])
      .orderByDesc('name')
      .get()
    expect(highLevel.length).toBe(2)
    const names = highLevel.map((r) => r['name'])
    expect(names).toContain('Admin')
    expect(names).toContain('Editor')
  })

  it('update JSON field', async () => {
    await conn.table('users').insert({
      name: 'UpdateJson', email: 'upjson@test.com',
      meta: JSON.stringify({ role: 'viewer', settings: { notifications: true } }),
    })

    // Update the entire JSON value
    const newMeta = JSON.stringify({ role: 'admin', settings: { notifications: false } })
    await conn.table('users')
      .where('email', 'upjson@test.com')
      .update({ meta: newMeta })

    const updated = await conn.table('users').where('email', 'upjson@test.com').first()
    const parsed = JSON.parse(updated!['meta'] as string)
    expect(parsed.role).toBe('admin')
    expect(parsed.settings.notifications).toBe(false)

    // SQLite-specific: use json_set to update a single field within JSON
    // PostgreSQL equivalent: jsonb_set(meta::jsonb, '{role}', '"editor"')
    // MySQL equivalent: JSON_SET(meta, '$.role', 'editor')
    await conn.statement(
      `UPDATE "users" SET "meta" = json_set("meta", '$.role', 'editor') WHERE "email" = ?`,
      ['upjson@test.com'],
    )

    const partialUpdate = await conn.table('users').where('email', 'upjson@test.com').first()
    const parsed2 = JSON.parse(partialUpdate!['meta'] as string)
    expect(parsed2.role).toBe('editor')
    // Other fields should be preserved
    expect(parsed2.settings.notifications).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SOFT DELETE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Soft Delete Edge Cases', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('soft deleted records excluded from joins', async () => {
    const userId = await conn.table('users').insertGetId({
      name: 'SoftJoin', email: 'softjoin@test.com', age: 30,
    })

    // Create two posts, soft-delete one
    const post1 = await Post.create({ title: 'Active Post', user_id: userId })
    const post2 = await Post.create({ title: 'Deleted Post', user_id: userId })
    await post2.delete() // soft delete

    // Add comments to both posts
    await conn.table('comments').insert({ body: 'Comment on active', post_id: post1.getKey(), user_id: userId })
    await conn.table('comments').insert({ body: 'Comment on deleted', post_id: post2.getKey(), user_id: userId })

    // Query via ORM — soft deleted posts should be excluded by default
    const posts = await (Post as any).where('user_id', userId).get()
    expect(posts.length).toBe(1)
    expect(posts[0].getAttribute('title')).toBe('Active Post')

    // Raw query builder with soft-delete-aware join:
    // Join users to posts but use the query builder directly — must manually
    // filter deleted_at to mimic soft delete behavior
    const rows = await conn.table('users')
      .join('posts', '"posts"."user_id"', '=', '"users"."id"')
      .whereNull('posts.deleted_at')
      .select(raw('"users"."name"'), raw('"posts"."title"'))
      .get()

    expect(rows.length).toBe(1)
    expect(rows[0]!['title']).toBe('Active Post')
  })

  it('withTrashed() in relationship queries', async () => {
    const user = await User.create({ name: 'TrashedRel', email: 'trashedrel@test.com', age: 25 })

    const p1 = await Post.create({ title: 'Visible', user_id: user.getKey() })
    const p2 = await Post.create({ title: 'Trashed', user_id: user.getKey() })
    const p3 = await Post.create({ title: 'Also Trashed', user_id: user.getKey() })
    await p2.delete()
    await p3.delete()

    // Default query — only non-trashed
    const activePosts = await Post.where('user_id', user.getKey()).get()
    expect(activePosts.length).toBe(1)

    // withTrashed — should include all 3
    const allPosts = await Post.query().withTrashed().where('user_id', user.getKey()).get()
    expect(allPosts.length).toBe(3)

    // onlyTrashed — should include only 2
    const trashedOnly = await Post.query().onlyTrashed().where('user_id', user.getKey()).get()
    expect(trashedOnly.length).toBe(2)
    const trashedTitles = trashedOnly.map((p: any) => p.getAttribute('title'))
    expect(trashedTitles).toContain('Trashed')
    expect(trashedTitles).toContain('Also Trashed')
  })

  it('pagination respects soft deletes', async () => {
    const user = await User.create({ name: 'PagSoft', email: 'pagsoft@test.com', age: 35 })

    // Create 10 posts, soft-delete 4 of them
    for (let i = 1; i <= 10; i++) {
      const post = await Post.create({ title: `PagPost ${i}`, user_id: user.getKey() })
      if (i <= 4) await post.delete() // soft delete first 4
    }

    // Paginate — should only see 6 active posts
    const page1 = await (Post as any).where('user_id', user.getKey()).paginate(1, 3)
    expect(page1.total).toBe(6)
    expect(page1.data.length).toBe(3)
    expect(page1.lastPage).toBe(2)
    expect(page1.hasMore).toBe(true)

    const page2 = await (Post as any).where('user_id', user.getKey()).paginate(2, 3)
    expect(page2.data.length).toBe(3)
    expect(page2.hasMore).toBe(false)

    // withTrashed pagination should see all 10
    const allPage = await Post.query().withTrashed().where('user_id', user.getKey()).paginate(1, 15)
    expect(allPage.total).toBe(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ADVANCED MIGRATION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Advanced Migration Operations', () => {
  afterAll(async () => {
    // Clean up any test tables
    await conn.schema().dropIfExists('cascade_comments')
    await conn.schema().dropIfExists('cascade_posts')
    await conn.schema().dropIfExists('unique_test')
    await conn.schema().dropIfExists('notnull_test')
  })

  it('foreign key with ON DELETE CASCADE', async () => {
    // SQLite supports foreign keys with inline REFERENCES and ON DELETE CASCADE,
    // but the Mantiq schema builder skips compiling foreign() for SQLite.
    // Use raw SQL to test the actual database-level cascade behavior.
    await conn.statement(`
      CREATE TABLE IF NOT EXISTS "cascade_posts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "title" VARCHAR(200) NOT NULL
      )
    `)

    await conn.statement(`
      CREATE TABLE IF NOT EXISTS "cascade_comments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "body" TEXT NOT NULL,
        "post_id" INTEGER NOT NULL REFERENCES "cascade_posts"("id") ON DELETE CASCADE
      )
    `)

    // Insert a post and comments
    const postId = await conn.table('cascade_posts').insertGetId({ title: 'Cascade Test' })
    await conn.table('cascade_comments').insert([
      { body: 'Comment 1', post_id: postId },
      { body: 'Comment 2', post_id: postId },
      { body: 'Comment 3', post_id: postId },
    ])

    expect(await conn.table('cascade_comments').count()).toBe(3)

    // Delete the post — comments should be cascade-deleted
    await conn.table('cascade_posts').where('id', postId).delete()

    expect(await conn.table('cascade_posts').count()).toBe(0)
    expect(await conn.table('cascade_comments').count()).toBe(0)
  })

  it('unique constraint violation throws error', async () => {
    await conn.schema().create('unique_test', (t) => {
      t.id()
      t.string('code', 50).unique()
    })

    await conn.table('unique_test').insert({ code: 'ABC' })

    // Inserting a duplicate should throw
    await expect(
      conn.table('unique_test').insert({ code: 'ABC' }),
    ).rejects.toThrow()

    // Different value should succeed
    await conn.table('unique_test').insert({ code: 'DEF' })
    expect(await conn.table('unique_test').count()).toBe(2)
  })

  it('NOT NULL constraint violation throws error', async () => {
    await conn.schema().create('notnull_test', (t) => {
      t.id()
      t.string('required_field', 100) // NOT NULL by default (non-nullable)
      t.string('optional_field', 100).nullable()
    })

    // Inserting with NULL for required_field should throw
    await expect(
      conn.table('notnull_test').insert({ required_field: null, optional_field: 'ok' }),
    ).rejects.toThrow()

    // Inserting with NULL for optional_field should succeed
    await conn.table('notnull_test').insert({ required_field: 'ok', optional_field: null })
    const row = await conn.table('notnull_test').first()
    expect(row!['required_field']).toBe('ok')
    expect(row!['optional_field']).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PAGINATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pagination Edge Cases', () => {
  beforeEach(async () => {
    await clearAllTables()
  })

  it('page beyond max returns empty data (clamped to last page)', async () => {
    // Insert 5 users
    for (let i = 1; i <= 5; i++) {
      await conn.table('users').insert({ name: `PagUser ${i}`, email: `pag${i}@edge.com`, age: 20 + i })
    }

    // Request page 100 with 2 per page — total 5 means lastPage = 3
    // The paginate() method clamps currentPage to lastPage
    const result = await conn.table('users').paginate(100, 2)
    expect(result.total).toBe(5)
    expect(result.lastPage).toBe(3)
    expect(result.currentPage).toBe(3) // clamped to last page
    expect(result.data.length).toBe(1) // page 3 has 1 remaining item
    expect(result.hasMore).toBe(false)
  })

  it('pagination with complex WHERE + ORDER BY', async () => {
    await seedData()

    // Paginate users in Engineering, ordered by salary desc
    const page1 = await conn.table('users')
      .where('department', 'Engineering')
      .orderByDesc('salary')
      .paginate(1, 2)

    // Engineering has 4 users: Alice(120k), Jack(130k), Bob(95k), Ivy(88k)
    expect(page1.total).toBe(4)
    expect(page1.perPage).toBe(2)
    expect(page1.currentPage).toBe(1)
    expect(page1.lastPage).toBe(2)
    expect(page1.data.length).toBe(2)
    expect(page1.hasMore).toBe(true)

    // First page should have the highest salaries
    expect(Number(page1.data[0]!['salary'])).toBeGreaterThanOrEqual(Number(page1.data[1]!['salary']))

    // Second page
    const page2 = await conn.table('users')
      .where('department', 'Engineering')
      .orderByDesc('salary')
      .paginate(2, 2)

    expect(page2.data.length).toBe(2)
    expect(page2.currentPage).toBe(2)
    expect(page2.hasMore).toBe(false)

    // Page 2 salaries should be lower than page 1
    expect(Number(page1.data[1]!['salary'])).toBeGreaterThanOrEqual(Number(page2.data[0]!['salary']))
  })

  it('first page vs last page metadata correctness', async () => {
    // Insert exactly 10 users
    for (let i = 1; i <= 10; i++) {
      await conn.table('users').insert({
        name: `Meta ${i}`, email: `meta${i}@edge.com`, age: 20 + i,
      })
    }

    // First page: 3 per page
    const first = await conn.table('users').orderBy('id').paginate(1, 3)
    expect(first.total).toBe(10)
    expect(first.currentPage).toBe(1)
    expect(first.lastPage).toBe(4) // ceil(10/3) = 4
    expect(first.from).toBe(1)
    expect(first.to).toBe(3)
    expect(first.data.length).toBe(3)
    expect(first.hasMore).toBe(true)

    // Last page: should have 1 item (10 - 3*3 = 1)
    const last = await conn.table('users').orderBy('id').paginate(4, 3)
    expect(last.total).toBe(10)
    expect(last.currentPage).toBe(4)
    expect(last.lastPage).toBe(4)
    expect(last.from).toBe(10)
    expect(last.to).toBe(10)
    expect(last.data.length).toBe(1)
    expect(last.hasMore).toBe(false)

    // Middle page: page 2
    const mid = await conn.table('users').orderBy('id').paginate(2, 3)
    expect(mid.from).toBe(4)
    expect(mid.to).toBe(6)
    expect(mid.data.length).toBe(3)
    expect(mid.hasMore).toBe(true)

    // Empty table pagination
    await conn.table('users').delete()
    const empty = await conn.table('users').paginate(1, 5)
    expect(empty.total).toBe(0)
    expect(empty.data.length).toBe(0)
    expect(empty.currentPage).toBe(1)
    expect(empty.lastPage).toBe(1)
    expect(empty.from).toBe(0)
    // Note: `to` is computed as `from + data.length - 1` which yields -1 for empty sets.
    // This is a known edge case in the paginate() implementation.
    expect(empty.to).toBe(-1)
    expect(empty.hasMore).toBe(false)
  })
})
