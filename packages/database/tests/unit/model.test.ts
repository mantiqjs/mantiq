import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Test model setup ──────────────────────────────────────────────────────────

function makeConn(rows: any[] = [], insertId = 1): DatabaseConnection {
  const grammar = new SQLiteGrammar()
  const conn: any = {
    _grammar: grammar,
    select: mock(async () => rows),
    statement: mock(async () => 1),
    insertGetId: mock(async () => insertId),
    transaction: mock(async (cb: any) => cb(conn)),
    table: (name: string) => new QueryBuilder(conn, name),
    schema: () => { throw new Error() },
    getDriverName: () => 'sqlite',
    getTablePrefix: () => '',
    // Universal executeXxx methods (delegate via Grammar)
    executeSelect: async (state: any) => {
      const { sql, bindings } = grammar.compileSelect(state)
      return conn.select(sql, bindings)
    },
    executeInsert: async (table: string, data: any) => {
      const { sql, bindings } = grammar.compileInsert(table, data)
      return conn.statement(sql, bindings)
    },
    executeInsertGetId: async (table: string, data: any) => {
      const { sql, bindings } = grammar.compileInsertGetId(table, data)
      return conn.insertGetId(sql, bindings)
    },
    executeUpdate: async (table: string, state: any, data: any) => {
      const { sql, bindings } = grammar.compileUpdate(table, state, data)
      return conn.statement(sql, bindings)
    },
    executeDelete: async (table: string, state: any) => {
      const { sql, bindings } = grammar.compileDelete(table, state)
      return conn.statement(sql, bindings)
    },
    executeTruncate: async (table: string) => {
      const sql = grammar.compileTruncate(table)
      return conn.statement(sql, [])
    },
    executeAggregate: async (state: any, fn: string, column: string) => {
      const aggState = { ...state, columns: [new Expression(`${fn.toUpperCase()}(${column}) as aggregate`)], orders: [] }
      const { sql, bindings } = grammar.compileSelect(aggState)
      const r = await conn.select(sql, bindings)
      return Number(r[0]?.['aggregate'] ?? 0)
    },
    executeExists: async (state: any) => {
      const existsState = { ...state, columns: [new Expression('1 as exists_check')], limitValue: 1, orders: [] }
      const { sql, bindings } = grammar.compileSelect(existsState)
      const r = await conn.select(sql, bindings)
      return r.length > 0
    },
  }
  return conn
}

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role']
  static override guarded = ['id']
  static override casts = { age: 'int' as const, is_active: 'boolean' as const }
  static override timestamps = true
}

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body', 'user_id']
  static override softDelete = true
  static override softDeleteColumn = 'deleted_at'
}

describe('Model static query API', () => {
  beforeEach(() => {
    User.connection = null
    Post.connection = null
  })

  test('throws when no connection set', () => {
    expect(() => User.query()).toThrow('No connection')
  })

  test('all() returns hydrated model instances', async () => {
    const conn = makeConn([{ id: 1, name: 'Alice', email: 'alice@example.com' }])
    User.setConnection(conn)
    const users = await User.all()
    expect(users).toHaveLength(1)
    expect(users[0]).toBeInstanceOf(User)
    expect(users[0]!.getAttribute('name')).toBe('Alice')
  })

  test('find() returns hydrated model or null', async () => {
    const conn = makeConn([{ id: 5, name: 'Bob' }])
    User.setConnection(conn)
    const user = await User.find(5)
    expect(user).toBeInstanceOf(User)
    expect(user!.getKey()).toBe(5)
  })

  test('find() returns null when not found', async () => {
    const conn = makeConn([])
    User.setConnection(conn)
    const user = await User.find(999)
    expect(user).toBeNull()
  })

  test('findOrFail() throws ModelNotFoundError', async () => {
    const conn = makeConn([])
    User.setConnection(conn)
    await expect(User.findOrFail(999)).rejects.toThrow()
  })

  test('where() chains correctly', async () => {
    const conn = makeConn([{ id: 1, name: 'Alice', role: 'admin' }])
    User.setConnection(conn)
    const users = await User.where('role', 'admin').get()
    expect(users).toHaveLength(1)
  })

  test('create() inserts and returns model with id', async () => {
    const conn = makeConn([], 42)
    User.setConnection(conn)
    const user = await User.create({ name: 'Carol', email: 'carol@example.com', role: 'user' })
    expect(user).toBeInstanceOf(User)
    expect(user.getKey()).toBe(42)
    expect((conn as any).insertGetId).toHaveBeenCalled()
  })

  test('count() returns number', async () => {
    const conn = makeConn([{ aggregate: 7 }])
    User.setConnection(conn)
    expect(await User.count()).toBe(7)
  })
})

describe('Model instance methods', () => {
  test('fill() only sets fillable fields', () => {
    const user = new User()
    user.fill({ id: 99, name: 'Alice', email: 'a@a.com', role: 'admin', unknown: 'x' })
    expect(user.getAttribute('name')).toBe('Alice')
    expect(user.getAttribute('id')).toBeUndefined()  // guarded
  })

  test('forceFill() sets all fields including guarded', () => {
    const user = new User()
    user.forceFill({ id: 99, name: 'Bob' })
    expect(user.getAttribute('id')).toBe(99)
  })

  test('isDirty() tracks changes', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice' })
    expect(user.isDirty()).toBe(false)
    user.fill({ name: 'Bob' })
    expect(user.isDirty()).toBe(true)
    expect(user.isDirty('name')).toBe(true)
    expect(user.isDirty('id')).toBe(false)
  })

  test('getDirty() returns only changed keys', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'a@a.com' })
    user.fill({ name: 'Bob' })
    const dirty = user.getDirty()
    expect(dirty).toHaveProperty('name', 'Bob')
    expect(dirty).not.toHaveProperty('email')
    expect(dirty).not.toHaveProperty('id')
  })

  test('casts: int cast', () => {
    const user = new User()
    user.setRawAttributes({ age: '25' })
    expect(user.getAttribute('age')).toBe(25)
    expect(typeof user.getAttribute('age')).toBe('number')
  })

  test('casts: boolean cast', () => {
    const user = new User()
    user.setRawAttributes({ is_active: 1 })
    expect(user.getAttribute('is_active')).toBe(true)
    user.setRawAttributes({ is_active: 0 })
    expect(user.getAttribute('is_active')).toBe(false)
  })

  test('toObject() excludes hidden fields', () => {
    class SecureUser extends Model {
      static override table = 'users'
      static override hidden = ['password']
    }
    const u = new SecureUser()
    u.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    const obj = u.toObject()
    expect(obj).not.toHaveProperty('password')
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('save() performs INSERT for new model', async () => {
    const conn = makeConn([], 10)
    User.setConnection(conn)
    const user = new User()
    user.fill({ name: 'Dave', email: 'd@d.com' })
    await user.save()
    expect(user.getKey()).toBe(10)
    expect((conn as any).insertGetId).toHaveBeenCalled()
  })

  test('save() performs UPDATE for existing model', async () => {
    const conn = makeConn()
    User.setConnection(conn)
    const user = new User()
    user.setRawAttributes({ id: 3, name: 'Eve' })
    ;(user as any)._exists = true
    user.fill({ name: 'Eve Updated' })
    await user.save()
    const [sql] = (conn as any).statement.mock.calls[0]
    expect(sql).toContain('UPDATE')
    expect(sql).toContain('"users"')
  })

  test('save() does nothing when not dirty', async () => {
    const conn = makeConn()
    User.setConnection(conn)
    const user = new User()
    user.setRawAttributes({ id: 3, name: 'Eve' })
    ;(user as any)._exists = true
    await user.save()
    expect((conn as any).statement).not.toHaveBeenCalled()
  })

  test('delete() removes record', async () => {
    const conn = makeConn()
    User.setConnection(conn)
    const user = new User()
    user.setRawAttributes({ id: 7, name: 'Frank' })
    ;(user as any)._exists = true
    await user.delete()
    const [sql] = (conn as any).statement.mock.calls[0]
    expect(sql).toContain('DELETE FROM')
  })
})

describe('Model soft deletes', () => {
  test('query() adds whereNull(deleted_at) by default', () => {
    const conn = makeConn()
    Post.setConnection(conn)
    const q = Post.query()
    const sql = q.toSql()
    expect(sql).toContain('"deleted_at" IS NULL')
  })

  test('withTrashed() removes soft delete filter', () => {
    const conn = makeConn()
    Post.setConnection(conn)
    const q = Post.query().withTrashed()
    const sql = q.toSql()
    expect(sql).not.toContain('"deleted_at" IS NULL')
  })

  test('onlyTrashed() filters to deleted records', () => {
    const conn = makeConn()
    Post.setConnection(conn)
    const q = Post.query().onlyTrashed()
    const sql = q.toSql()
    expect(sql).toContain('"deleted_at" IS NOT NULL')
  })

  test('delete() sets deleted_at instead of deleting', async () => {
    const conn = makeConn()
    Post.setConnection(conn)
    const post = new Post()
    post.setRawAttributes({ id: 1, title: 'Hello', deleted_at: null })
    ;(post as any)._exists = true
    await post.delete()
    const [sql] = (conn as any).statement.mock.calls[0]
    expect(sql).toContain('UPDATE')
    expect(sql).toContain('"deleted_at"')
  })

  test('forceDelete() always deletes', async () => {
    const conn = makeConn()
    Post.setConnection(conn)
    const post = new Post()
    post.setRawAttributes({ id: 1, title: 'Hello' })
    ;(post as any)._exists = true
    await post.forceDelete()
    const [sql] = (conn as any).statement.mock.calls[0]
    expect(sql).toContain('DELETE FROM')
  })

  test('isTrashed() returns true when deleted_at is set', () => {
    const post = new Post()
    post.setRawAttributes({ id: 1, deleted_at: '2024-01-01' })
    expect(post.isTrashed()).toBe(true)
  })

  test('isTrashed() returns false when deleted_at is null', () => {
    const post = new Post()
    post.setRawAttributes({ id: 1, deleted_at: null })
    expect(post.isTrashed()).toBe(false)
  })
})

describe('Model relations', () => {
  test('hasMany returns HasManyRelation with correct query', async () => {
    class Comment extends Model {
      static override table = 'comments'
      static override fillable = ['body', 'user_id']
    }

    const conn = makeConn([{ id: 1, body: 'Great post', user_id: 5 }])
    User.setConnection(conn)
    Comment.setConnection(conn)

    const user = new User()
    user.setRawAttributes({ id: 5, name: 'Alice' })
    ;(user as any)._exists = true

    const relation = (user as any).hasMany(Comment, 'user_id')
    const comments = await relation.get()
    expect(comments).toHaveLength(1)
    const calledSql = (conn as any).select.mock.calls[0][0]
    expect(calledSql).toContain('"user_id" = ?')
  })

  test('belongsTo returns BelongsToRelation', async () => {
    const conn = makeConn([{ id: 5, name: 'Alice' }])
    User.setConnection(conn)

    class Comment extends Model {
      static override table = 'comments'
      static override fillable = ['body', 'user_id']
    }
    Comment.setConnection(conn)

    const comment = new Comment()
    comment.setRawAttributes({ id: 1, body: 'Hi', user_id: 5 })

    const relation = (comment as any).belongsTo(User, 'user_id', 'id')
    const user = await relation.get()
    expect(user).toBeInstanceOf(User)
    expect(user!.getAttribute('name')).toBe('Alice')
  })
})
