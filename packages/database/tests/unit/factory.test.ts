import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Factory } from '../../src/factories/Factory.ts'
import { Model } from '../../src/orm/Model.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

function makeConn(insertId = 1): DatabaseConnection {
  const conn: any = {
    _grammar: new SQLiteGrammar(),
    select: mock(async () => []),
    statement: mock(async () => 1),
    insertGetId: mock(async () => insertId),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: () => { throw new Error() },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
  }
  return conn
}

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role']
  static override guarded = ['id']
}

class UserFactory extends Factory<User> {
  protected model = User

  definition(index: number) {
    return {
      name: `User ${index}`,
      email: `user${index}@example.com`,
      role: 'user',
    }
  }
}

describe('Factory', () => {
  beforeEach(() => {
    User.connection = null
  })

  test('raw() returns attribute object', () => {
    const attrs = new UserFactory().raw() as Record<string, any>
    expect(attrs).toHaveProperty('name')
    expect(attrs).toHaveProperty('email')
    expect(attrs).toHaveProperty('role', 'user')
  })

  test('raw() with overrides', () => {
    const attrs = new UserFactory().raw({ role: 'admin' }) as Record<string, any>
    expect(attrs.role).toBe('admin')
  })

  test('raw() count(3) returns array', () => {
    const attrs = new UserFactory().count(3).raw() as Record<string, any>[]
    expect(Array.isArray(attrs)).toBe(true)
    expect(attrs).toHaveLength(3)
  })

  test('raw() increments index per call', () => {
    const f = new UserFactory()
    const a = f.raw() as Record<string, any>
    const b = f.raw() as Record<string, any>
    expect(a.name).not.toBe(b.name)
  })

  test('state() applies overrides', () => {
    const attrs = new UserFactory().state({ role: 'moderator' }).raw() as Record<string, any>
    expect(attrs.role).toBe('moderator')
  })

  test('state() with function', () => {
    const attrs = new UserFactory().state((i) => ({ name: `Admin ${i}` })).raw() as Record<string, any>
    expect(attrs.name).toMatch(/^Admin \d+$/)
  })

  test('make() returns Model instance (not persisted)', () => {
    User.connection = makeConn()
    const user = new UserFactory().make() as User
    expect(user).toBeInstanceOf(User)
    expect(user.getAttribute('name')).toBeDefined()
    // Not persisted — no insertGetId called
  })

  test('make() count(2) returns array of models', () => {
    User.connection = makeConn()
    const users = new UserFactory().count(2).make() as User[]
    expect(Array.isArray(users)).toBe(true)
    expect(users).toHaveLength(2)
  })

  test('create() persists model', async () => {
    const conn = makeConn(99)
    User.setConnection(conn)
    const user = await new UserFactory().create() as User
    expect(user).toBeInstanceOf(User)
    expect(user.getKey()).toBe(99)
    expect((conn as any).insertGetId).toHaveBeenCalled()
  })

  test('create() count(3) persists 3 models', async () => {
    let id = 0
    const conn = makeConn(0)
    ;(conn as any).insertGetId = mock(async () => ++id)
    User.setConnection(conn)
    const users = await new UserFactory().count(3).create() as User[]
    expect(users).toHaveLength(3)
    expect((conn as any).insertGetId).toHaveBeenCalledTimes(3)
  })

  test('afterCreate() callback is called after persistence', async () => {
    const conn = makeConn(1)
    User.setConnection(conn)
    let called = false
    const user = await new UserFactory()
      .afterCreate(async (u) => { called = true })
      .create() as User
    expect(called).toBe(true)
  })
})
