import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'
import { MorphOneRelation } from '../../src/orm/relations/MorphOneRelation.ts'
import { MorphManyRelation } from '../../src/orm/relations/MorphManyRelation.ts'
import { MorphToRelation } from '../../src/orm/relations/MorphToRelation.ts'
import { QueryBuilder } from '../../src/query/Builder.ts'
import { SQLiteGrammar } from '../../src/drivers/SQLiteGrammar.ts'
import { Expression } from '../../src/query/Expression.ts'
import type { DatabaseConnection } from '../../src/contracts/Connection.ts'

// ── Test helpers ──────────────────────────────────────────────────────────────

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

// ── Test models ──────────────────────────────────────────────────────────────

class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body']

  comments() {
    return this.morphMany(Comment, 'commentable')
  }

  image() {
    return this.morphOne(Image, 'imageable')
  }

  tags() {
    return this.morphToMany(Tag, 'taggable')
  }
}

class Video extends Model {
  static override table = 'videos'
  static override fillable = ['title', 'url']

  comments() {
    return this.morphMany(Comment, 'commentable')
  }

  image() {
    return this.morphOne(Image, 'imageable')
  }
}

class Comment extends Model {
  static override table = 'comments'
  static override fillable = ['body', 'commentable_type', 'commentable_id']

  commentable() {
    return this.morphTo('commentable', { Post, Video })
  }
}

class Image extends Model {
  static override table = 'images'
  static override fillable = ['url', 'imageable_type', 'imageable_id']

  imageable() {
    return this.morphTo('imageable', { Post, Video })
  }
}

class Tag extends Model {
  static override table = 'tags'
  static override fillable = ['name']
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Polymorphic Relations', () => {
  beforeEach(() => {
    Post.connection = null
    Video.connection = null
    Comment.connection = null
    Image.connection = null
    Tag.connection = null
  })

  describe('morphMany', () => {
    test('returns MorphManyRelation with correct type and key', () => {
      const conn = makeConn()
      Post.setConnection(conn)
      Comment.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 1, title: 'Hello' })

      const relation = post.comments()
      expect(relation).toBeInstanceOf(MorphManyRelation)
    })

    test('morphMany queries with correct where clauses', async () => {
      const conn = makeConn([
        { id: 1, body: 'Nice!', commentable_type: 'Post', commentable_id: 5 },
      ])
      Post.setConnection(conn)
      Comment.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 5, title: 'Hello' })

      const comments = await post.comments().get()
      expect(comments).toHaveLength(1)

      // Check that the query included the type and id conditions
      const calledSql = (conn as any).select.mock.calls[0][0]
      expect(calledSql).toContain('"commentable_type"')
      expect(calledSql).toContain('"commentable_id"')
    })

    test('morphMany create() sets type and id', async () => {
      const conn = makeConn([], 10)
      Post.setConnection(conn)
      Comment.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 3, title: 'Test' })

      const comment = await post.comments().create({ body: 'Great post!' })
      expect(comment).toBeInstanceOf(Comment)
      expect(comment.getKey()).toBe(10)
    })
  })

  describe('morphOne', () => {
    test('returns MorphOneRelation', () => {
      const conn = makeConn()
      Post.setConnection(conn)
      Image.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 1, title: 'Hello' })

      const relation = post.image()
      expect(relation).toBeInstanceOf(MorphOneRelation)
    })

    test('morphOne queries with correct where clauses', async () => {
      const conn = makeConn([
        { id: 1, url: 'img.jpg', imageable_type: 'Post', imageable_id: 5 },
      ])
      Post.setConnection(conn)
      Image.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 5, title: 'Hello' })

      const image = await post.image().get()
      expect(image).toBeInstanceOf(Image)

      const calledSql = (conn as any).select.mock.calls[0][0]
      expect(calledSql).toContain('"imageable_type"')
      expect(calledSql).toContain('"imageable_id"')
    })

    test('morphOne returns null when no match', async () => {
      const conn = makeConn([])
      Post.setConnection(conn)
      Image.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 5, title: 'Hello' })

      const image = await post.image().get()
      expect(image).toBeNull()
    })
  })

  describe('morphTo', () => {
    test('returns MorphToRelation', () => {
      const conn = makeConn()
      Comment.setConnection(conn)
      Post.setConnection(conn)
      Video.setConnection(conn)

      const comment = new Comment()
      comment.setRawAttributes({ id: 1, body: 'Nice', commentable_type: 'Post', commentable_id: 5 })

      const relation = comment.commentable()
      expect(relation).toBeInstanceOf(MorphToRelation)
    })

    test('morphTo resolves the correct parent model', async () => {
      const conn = makeConn([{ id: 5, title: 'Hello' }])
      Comment.setConnection(conn)
      Post.setConnection(conn)
      Video.setConnection(conn)

      const comment = new Comment()
      comment.setRawAttributes({ id: 1, body: 'Nice', commentable_type: 'Post', commentable_id: 5 })

      const parent = await comment.commentable().get()
      expect(parent).toBeInstanceOf(Post)
      expect(parent!.getAttribute('title')).toBe('Hello')
    })

    test('morphTo returns null when type is null', async () => {
      const conn = makeConn()
      Comment.setConnection(conn)
      Post.setConnection(conn)

      const comment = new Comment()
      comment.setRawAttributes({ id: 1, body: 'Orphan', commentable_type: null, commentable_id: null })

      const parent = await comment.commentable().get()
      expect(parent).toBeNull()
    })

    test('morphTo returns null when type is not in morph map', async () => {
      const conn = makeConn()
      Comment.setConnection(conn)
      Post.setConnection(conn)

      const comment = new Comment()
      comment.setRawAttributes({ id: 1, body: 'Bad', commentable_type: 'UnknownModel', commentable_id: 1 })

      const parent = await comment.commentable().get()
      expect(parent).toBeNull()
    })
  })

  describe('morphToMany', () => {
    test('morphToMany uses pivot table with morph type column', async () => {
      const pivotRows = [2, 3]
      const tagRows = [
        { id: 2, name: 'TypeScript' },
        { id: 3, name: 'Bun' },
      ]

      // First call: pivot table pluck, second call: tag query
      let callCount = 0
      const conn = makeConn()
      ;(conn as any).select = mock(async () => {
        callCount++
        // First call is pluck on pivot table, second is the tag query
        if (callCount === 1) return pivotRows.map(id => ({ tag_id: id }))
        return tagRows
      })

      Post.setConnection(conn)
      Tag.setConnection(conn)

      const post = new Post()
      post.setRawAttributes({ id: 1, title: 'Hello' })

      const tags = await post.tags().get()
      expect(tags).toHaveLength(2)
    })
  })

  describe('Model.morphMap', () => {
    test('registers morph type aliases', () => {
      Model.morphMap({ 'post': Post as any, 'video': Video as any })
      expect(Model._morphMap).toHaveProperty('post')
      expect(Model._morphMap).toHaveProperty('video')
    })

    test('getMorphType returns class name by default', () => {
      // Clear any previously set morphMap entries for this test
      const originalMap = { ...Post._morphMap }
      Post._morphMap = {}
      expect(Post.getMorphType()).toBe('Post')
      Post._morphMap = originalMap
    })
  })

  describe('Model.observe (stub)', () => {
    test('observe exists as a static method', () => {
      expect(typeof Post.observe).toBe('function')
    })

    test('observe is a no-op without events package', () => {
      // Should not throw
      Post.observe({})
    })
  })
})
