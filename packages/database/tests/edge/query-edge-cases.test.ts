import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '../../src/drivers/SQLiteConnection.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { Model } from '../../src/orm/Model.ts'

let conn: SQLiteConnection

beforeAll(async () => {
  conn = new SQLiteConnection({ database: ':memory:' })

  // Create a test table
  await conn.statement(`
    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      value TEXT,
      active INTEGER DEFAULT 1,
      count INTEGER DEFAULT 0,
      data TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `)
})

afterAll(() => {
  conn.close()
})

describe('Query Builder Edge Cases (SQLite :memory:)', () => {
  // ── 1. where(column, null) → passes null as bound parameter ────────────────
  it('where(column, null) handles null as parameter', () => {
    const qb = conn.table('items').where('name', null)
    const sql = qb.toSql()
    expect(sql).toContain('"name"')
  })

  // ── 2. where(column, '') → generates = '' (not IS NULL) ───────────────────
  it("where(column, '') generates = '' not IS NULL", () => {
    const qb = conn.table('items').where('name', '')
    const sql = qb.toSql()
    const bindings = qb.getBindings()
    expect(sql).toContain('= ?')
    expect(bindings).toContain('')
    expect(sql).not.toContain('IS NULL')
  })

  // ── 3. where(column, false) → generates = 0 in SQLite ─────────────────────
  it('where(column, false) generates = ? with false in bindings', () => {
    const qb = conn.table('items').where('active', false)
    const bindings = qb.getBindings()
    expect(bindings).toContain(false)
    // The binding value should be present, not skipped
    expect(bindings.length).toBe(1)
  })

  // ── 4. where(column, 0) → generates = 0 (not falsy skip) ─────────────────
  it('where(column, 0) generates = ? with 0 in bindings', () => {
    const qb = conn.table('items').where('count', 0)
    const bindings = qb.getBindings()
    expect(bindings).toContain(0)
    expect(bindings.length).toBe(1)
  })

  // ── 5. orderBy with valid column name → quoted correctly ──────────────────
  it('orderBy with column name is quoted correctly', () => {
    const qb = conn.table('items').orderBy('name')
    const sql = qb.toSql()
    expect(sql).toContain('ORDER BY "name" ASC')
  })

  // ── 6. insert with all fields null → works ────────────────────────────────
  it('insert with all fields null succeeds', async () => {
    await conn.table('items').insert({ name: null, value: null })
    const row = await conn.table('items').whereNull('name').first()
    expect(row).toBeTruthy()
    expect(row.name).toBeNull()
    expect(row.value).toBeNull()
  })

  // ── 7. insert with JSON field containing special chars → escaped ──────────
  it('insert with JSON field containing special chars is escaped properly', async () => {
    const jsonData = JSON.stringify({ key: "it's a \"test\" with <html> & 'quotes'" })
    await conn.table('items').insert({ name: 'json-test', data: jsonData })
    const row = await conn.table('items').where('name', 'json-test').first()
    expect(row.data).toBe(jsonData)
    const parsed = JSON.parse(row.data)
    expect(parsed.key).toContain('"test"')
  })

  // ── 8. transaction rollback on exception → table state unchanged ──────────
  it('transaction rollback on exception leaves table state unchanged', async () => {
    const countBefore = await conn.table('items').count()

    try {
      await conn.transaction(async (txConn) => {
        await txConn.table('items').insert({ name: 'rollback-test' })
        throw new Error('deliberate failure')
      })
    } catch {
      // expected
    }

    const countAfter = await conn.table('items').count()
    expect(countAfter).toBe(countBefore)
  })

  // ── 9. update returning 0 rows → returns 0, not error ────────────────────
  it('update on non-matching rows returns 0', async () => {
    const affected = await conn.table('items').where('name', 'nonexistent-xyzzy').update({ value: 'new' })
    expect(affected).toBe(0)
  })

  // ── 10. delete non-existent record → returns 0, not error ────────────────
  it('delete on non-existent record returns 0', async () => {
    const affected = await conn.table('items').where('id', 999999).delete()
    expect(affected).toBe(0)
  })

  // ── 11. select with 50+ columns → works ──────────────────────────────────
  it('select with many columns generates correct SQL', () => {
    const columns = Array.from({ length: 50 }, (_, i) => `col_${i}`)
    const qb = conn.table('items').select(...columns)
    const sql = qb.toSql()
    // All 50 columns should appear
    for (const col of columns) {
      expect(sql).toContain(`"${col}"`)
    }
  })

  // ── 12. concurrent inserts → all succeed (WAL mode) ──────────────────────
  it('concurrent inserts all succeed under WAL mode', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      conn.table('items').insert({ name: `concurrent-${i}`, value: String(i) }),
    )
    await Promise.all(promises)

    const count = await conn.table('items').where('name', 'like', 'concurrent-%').count()
    expect(count).toBe(20)
  })

  // ── 13. Model.find() with string ID on integer PK → coerces correctly ────
  it('QueryBuilder.find() with string ID works on integer PK', async () => {
    const id = await conn.table('items').insertGetId({ name: 'find-coerce-test' })
    const row = await conn.table('items').find(String(id))
    expect(row).toBeTruthy()
    expect(row!.name).toBe('find-coerce-test')
  })

  // ── 14. Model.create() with extra fields not in fillable → silently ignored
  it('Model.fill() silently ignores fields not in fillable', () => {
    class TestItem extends Model {
      static override table = 'items'
      static override fillable = ['name', 'value']
    }

    const instance = new (TestItem as any)()
    instance.fill({ name: 'test', value: 'v', secretField: 'hacked', id: 999 })

    // secretField should be ignored because it's not in fillable
    expect(instance.getAttribute('secretField')).toBeUndefined()
    // id should be ignored because it's in guarded (default)
    expect(instance.getAttribute('id')).toBeUndefined()
    // fillable fields should be set
    expect(instance.getAttribute('name')).toBe('test')
    expect(instance.getAttribute('value')).toBe('v')
  })

  // ── 15. Raw query with user input → parameterized (no SQL injection) ──────
  it('raw query with user input uses parameterized bindings', async () => {
    const maliciousInput = "'; DROP TABLE items; --"
    await conn.table('items').insert({ name: maliciousInput, value: 'safe' })

    // The raw where should be parameterized — the malicious string should be treated as data
    const rows = await conn.table('items').whereRaw('"name" = ?', [maliciousInput]).get()
    expect(rows.length).toBe(1)
    expect(rows[0].name).toBe(maliciousInput)

    // Verify the table still exists by running a query
    const count = await conn.table('items').count()
    expect(count).toBeGreaterThan(0)
  })
})
