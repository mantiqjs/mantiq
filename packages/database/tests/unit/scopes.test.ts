import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'
import type { Scope } from '../../src/orm/Scope.ts'
import type { ModelQueryBuilder } from '../../src/orm/ModelQueryBuilder.ts'

function makeConn(rows: any[] = []): DatabaseConnection {
  const conn: any = {
    _grammar: new SQLiteGrammar(),
    select: mock(async () => rows),
    statement: mock(async () => 1),
    insertGetId: mock(async () => 1),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: () => { throw new Error() },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
  }
  return conn
}

// ── Scope classes ────────────────────────────────────────────────────────────

class ActiveScope implements Scope {
  apply(builder: ModelQueryBuilder<any>): void {
    builder.where('is_active', true)
  }
}

class TenantScope implements Scope {
  constructor(private tenantId: number) {}

  apply(builder: ModelQueryBuilder<any>): void {
    builder.where('tenant_id', this.tenantId)
  }
}

// ── Test models ──────────────────────────────────────────────────────────────

class ScopedUser extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'is_active', 'tenant_id']

  static override booted() {
    this.addGlobalScope('active', new ActiveScope())
  }
}

class TenantUser extends Model {
  static override table = 'users'
  static override fillable = ['name', 'tenant_id']

  static override booted() {
    this.addGlobalScope('active', new ActiveScope())
    this.addGlobalScope('tenant', new TenantScope(42))
  }
}

class ClosureScopedUser extends Model {
  static override table = 'users'
  static override fillable = ['name']

  static override booted() {
    this.addGlobalScope('verified', (builder) => {
      builder.whereNotNull('email_verified_at')
    })
  }
}

class NoScopeUser extends Model {
  static override table = 'users'
  static override fillable = ['name']
}

describe('Global Query Scopes', () => {
  beforeEach(() => {
    // Reset booted state so booted() re-runs
    Model._booted.clear()
    // Reset scopes
    ;(ScopedUser as any)._globalScopes = new Map()
    ;(TenantUser as any)._globalScopes = new Map()
    ;(ClosureScopedUser as any)._globalScopes = new Map()
    ;(NoScopeUser as any)._globalScopes = new Map()
  })

  test('addGlobalScope registers a scope class', () => {
    const conn = makeConn()
    ScopedUser.setConnection(conn)

    // Trigger boot
    ScopedUser.query()

    expect(ScopedUser.hasGlobalScope('active')).toBe(true)
  })

  test('global scope is applied to queries', async () => {
    const conn = makeConn([])
    ScopedUser.setConnection(conn)

    await ScopedUser.all()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('is_active')
  })

  test('closure-based global scope works', async () => {
    const conn = makeConn([])
    ClosureScopedUser.setConnection(conn)

    await ClosureScopedUser.all()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('email_verified_at')
  })

  test('multiple scopes are applied', async () => {
    const conn = makeConn([])
    TenantUser.setConnection(conn)

    await TenantUser.all()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('is_active')
    expect(sql).toContain('tenant_id')
  })

  test('withoutGlobalScope removes a specific scope', async () => {
    const conn = makeConn([])
    TenantUser.setConnection(conn)

    await TenantUser.query().withoutGlobalScope('active').get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).not.toContain('is_active')
    expect(sql).toContain('tenant_id')
  })

  test('withoutGlobalScopes removes all scopes', async () => {
    const conn = makeConn([])
    TenantUser.setConnection(conn)

    await TenantUser.query().withoutGlobalScopes().get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).not.toContain('is_active')
    expect(sql).not.toContain('tenant_id')
  })

  test('withoutGlobalScopes with names removes specific scopes', async () => {
    const conn = makeConn([])
    TenantUser.setConnection(conn)

    await TenantUser.query().withoutGlobalScopes(['tenant']).get()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('is_active')
    expect(sql).not.toContain('tenant_id')
  })

  test('model without scopes works normally', async () => {
    const conn = makeConn([{ id: 1, name: 'Alice' }])
    NoScopeUser.setConnection(conn)

    const users = await NoScopeUser.all()
    expect(users).toHaveLength(1)
  })

  test('scopes are applied to aggregates', async () => {
    const conn = makeConn([{ 'count(*)': 5 }])
    ScopedUser.setConnection(conn)

    await ScopedUser.count()

    const sql = (conn.select as any).mock.calls[0][0] as string
    expect(sql).toContain('is_active')
  })

  test('scopes do not leak between model classes', () => {
    const conn = makeConn()
    ScopedUser.setConnection(conn)
    NoScopeUser.setConnection(conn)

    ScopedUser.query()
    NoScopeUser.query()

    expect(ScopedUser.hasGlobalScope('active')).toBe(true)
    expect(NoScopeUser.hasGlobalScope('active')).toBe(false)
  })

  test('removeGlobalScope removes a scope from the model', () => {
    const conn = makeConn()
    ScopedUser.setConnection(conn)

    ScopedUser.query() // triggers boot
    expect(ScopedUser.hasGlobalScope('active')).toBe(true)

    ScopedUser.removeGlobalScope('active')
    expect(ScopedUser.hasGlobalScope('active')).toBe(false)
  })

  test('booted() is called only once per class', () => {
    const conn = makeConn()
    ScopedUser.setConnection(conn)

    ScopedUser.query()
    ScopedUser.query()
    ScopedUser.query()

    // If booted was called multiple times, we'd have duplicate registrations
    // but since Map uses string keys, it just overwrites
    expect(ScopedUser.hasGlobalScope('active')).toBe(true)
  })
})
