import { describe, test, expect } from 'bun:test'
import { Model } from '../../src/orm/Model.ts'

// ── Test models ──────────────────────────────────────────────────────────────

class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role']
  static override hidden = ['password']

  getFullNameAttribute(): string {
    return `${this._attributes.first_name} ${this._attributes.last_name}`
  }

  getUpperNameAttribute(): string {
    return (this._attributes.name ?? '').toUpperCase()
  }
}

class VisibleUser extends Model {
  static override table = 'users'
  static override visible = ['id', 'name']
}

class AppendedUser extends Model {
  static override table = 'users'
  static override fillable = ['first_name', 'last_name']
  static override appends = ['full_name']

  getFullNameAttribute(): string {
    return `${this._attributes.first_name} ${this._attributes.last_name}`
  }
}

class SecureUser extends Model {
  static override table = 'users'
  static override hidden = ['password', 'remember_token']
  static override appends = ['display_name']

  getDisplayNameAttribute(): string {
    return this._attributes.name ?? 'Unknown'
  }
}

// ── Tests: static hidden ─────────────────────────────────────────────────────

describe('Model Serialization — hidden', () => {
  test('toObject() excludes hidden fields', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    const obj = user.toObject()
    expect(obj).not.toHaveProperty('password')
    expect(obj).toHaveProperty('name', 'Alice')
    expect(obj).toHaveProperty('id', 1)
  })

  test('toObject() excludes multiple hidden fields', () => {
    const user = new SecureUser()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret', remember_token: 'abc123' })
    const obj = user.toObject()
    expect(obj).not.toHaveProperty('password')
    expect(obj).not.toHaveProperty('remember_token')
    expect(obj).toHaveProperty('name', 'Alice')
  })
})

// ── Tests: static visible ────────────────────────────────────────────────────

describe('Model Serialization — visible', () => {
  test('toObject() includes only visible fields when set', () => {
    const user = new VisibleUser()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret' })
    const obj = user.toObject()
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('name', 'Alice')
    expect(obj).not.toHaveProperty('email')
    expect(obj).not.toHaveProperty('password')
  })

  test('visible is not applied when empty array', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com' })
    const obj = user.toObject()
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('name', 'Alice')
    expect(obj).toHaveProperty('email', 'alice@example.com')
  })
})

// ── Tests: static appends ────────────────────────────────────────────────────

describe('Model Serialization — appends', () => {
  test('toObject() includes appended computed attributes', () => {
    const user = new AppendedUser()
    user.setRawAttributes({ id: 1, first_name: 'John', last_name: 'Doe' })
    const obj = user.toObject()
    expect(obj).toHaveProperty('full_name', 'John Doe')
    expect(obj).toHaveProperty('first_name', 'John')
    expect(obj).toHaveProperty('last_name', 'Doe')
  })

  test('appends work alongside hidden', () => {
    const user = new SecureUser()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret', remember_token: 'abc' })
    const obj = user.toObject()
    expect(obj).toHaveProperty('display_name', 'Alice')
    expect(obj).not.toHaveProperty('password')
    expect(obj).not.toHaveProperty('remember_token')
  })
})

// ── Tests: instance only() ───────────────────────────────────────────────────

describe('Model Serialization — only()', () => {
  test('only() limits fields to those specified', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret', role: 'admin' })
    const obj = user.only('id', 'name').toObject()
    expect(obj).toEqual({ id: 1, name: 'Alice' })
  })

  test('only() overrides hidden', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    const obj = user.only('id', 'password').toObject()
    expect(obj).toHaveProperty('password', 'secret')
    expect(obj).toHaveProperty('id', 1)
    expect(obj).not.toHaveProperty('name')
  })

  test('only() still includes appends', () => {
    const user = new AppendedUser()
    user.setRawAttributes({ id: 1, first_name: 'John', last_name: 'Doe' })
    const obj = user.only('id').toObject()
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('full_name', 'John Doe')
    expect(obj).not.toHaveProperty('first_name')
  })

  test('only() returns this for chaining', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice' })
    const result = user.only('id')
    expect(result).toBe(user)
  })
})

// ── Tests: instance except() ────────────────────────────────────────────────

describe('Model Serialization — except()', () => {
  test('except() excludes specified fields', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' })
    const obj = user.except('email', 'role').toObject()
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('name', 'Alice')
    expect(obj).not.toHaveProperty('email')
    expect(obj).not.toHaveProperty('role')
  })

  test('except() combines with hidden', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret' })
    const obj = user.except('email').toObject()
    expect(obj).not.toHaveProperty('password')  // already hidden
    expect(obj).not.toHaveProperty('email')      // newly excepted
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('except() returns this for chaining', () => {
    const user = new User()
    user.setRawAttributes({ id: 1 })
    const result = user.except('id')
    expect(result).toBe(user)
  })
})

// ── Tests: instance append() ────────────────────────────────────────────────

describe('Model Serialization — append()', () => {
  test('append() adds computed attributes at instance level', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', first_name: 'Alice', last_name: 'Smith' })
    const obj = user.append('full_name').toObject()
    expect(obj).toHaveProperty('full_name', 'Alice Smith')
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('append() stacks with multiple calls', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', first_name: 'Alice', last_name: 'Smith' })
    const obj = user.append('full_name').append('upper_name').toObject()
    expect(obj).toHaveProperty('full_name', 'Alice Smith')
    expect(obj).toHaveProperty('upper_name', 'ALICE')
  })

  test('append() combines with static appends', () => {
    const user = new AppendedUser()
    user.setRawAttributes({ id: 1, first_name: 'John', last_name: 'Doe' })
    // Static appends already includes 'full_name', this should not duplicate
    const obj = user.append('full_name').toObject()
    expect(obj).toHaveProperty('full_name', 'John Doe')
  })

  test('append() returns this for chaining', () => {
    const user = new User()
    user.setRawAttributes({ id: 1 })
    const result = user.append('full_name')
    expect(result).toBe(user)
  })
})

// ── Tests: makeVisible / makeHidden ─────────────────────────────────────────

describe('Model Serialization — makeVisible() / makeHidden()', () => {
  test('makeVisible() reveals a statically hidden field', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    const obj = user.makeVisible('password').toObject()
    expect(obj).toHaveProperty('password', 'secret')
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('makeVisible() does not affect other instances', () => {
    const user1 = new User()
    user1.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    user1.makeVisible('password')

    const user2 = new User()
    user2.setRawAttributes({ id: 2, name: 'Bob', password: 'other-secret' })

    expect(user1.toObject()).toHaveProperty('password', 'secret')
    expect(user2.toObject()).not.toHaveProperty('password')
  })

  test('makeHidden() hides a field at instance level', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com' })
    const obj = user.makeHidden('email').toObject()
    expect(obj).not.toHaveProperty('email')
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('makeHidden() stacks with static hidden', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret' })
    const obj = user.makeHidden('email').toObject()
    expect(obj).not.toHaveProperty('email')
    expect(obj).not.toHaveProperty('password')
    expect(obj).toHaveProperty('name', 'Alice')
  })

  test('makeVisible() and makeHidden() return this for chaining', () => {
    const user = new User()
    user.setRawAttributes({ id: 1 })
    expect(user.makeVisible('password')).toBe(user)
    expect(user.makeHidden('email')).toBe(user)
  })

  test('makeHidden() overrides makeVisible() when both used', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    // First make it visible, then hide it again
    const obj = user.makeVisible('password').makeHidden('password').toObject()
    // makeHidden adds to hidden set after makeVisible removes — hidden wins
    // because both arrays are processed: visible removes from set, hidden adds back
    expect(obj).not.toHaveProperty('password')
  })
})

// ── Tests: toJSON ────────────────────────────────────────────────────────────

describe('Model Serialization — toJSON()', () => {
  test('toJSON() delegates to toObject()', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })
    const json = user.toJSON()
    expect(json).not.toHaveProperty('password')
    expect(json).toHaveProperty('name', 'Alice')
  })

  test('toJSON() respects only()', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com' })
    const json = user.only('id').toJSON()
    expect(json).toHaveProperty('id', 1)
    expect(json).not.toHaveProperty('name')
  })
})

// ── Tests: combined scenarios ────────────────────────────────────────────────

describe('Model Serialization — combined', () => {
  test('visible + hidden + appends all work together', () => {
    class ComboUser extends Model {
      static override table = 'users'
      static override visible = ['id', 'name', 'secret']
      static override hidden = ['secret']
      static override appends = ['greeting']

      getGreetingAttribute(): string {
        return `Hello ${this._attributes.name}`
      }
    }

    const user = new ComboUser()
    user.setRawAttributes({ id: 1, name: 'Alice', email: 'alice@example.com', secret: 'shh' })
    const obj = user.toObject()
    // 'secret' is in visible but also in hidden — hidden wins
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('name', 'Alice')
    expect(obj).not.toHaveProperty('secret')
    expect(obj).not.toHaveProperty('email')  // not in visible
    expect(obj).toHaveProperty('greeting', 'Hello Alice')
  })

  test('except + appends', () => {
    const user = new AppendedUser()
    user.setRawAttributes({ id: 1, first_name: 'John', last_name: 'Doe' })
    const obj = user.except('last_name').toObject()
    expect(obj).toHaveProperty('id', 1)
    expect(obj).toHaveProperty('first_name', 'John')
    expect(obj).not.toHaveProperty('last_name')
    expect(obj).toHaveProperty('full_name', 'John Doe')
  })

  test('relations are serialized and respect hidden', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice', password: 'secret' })

    // Simulate a loaded relation
    const post = new (class extends Model {
      static override table = 'posts'
    })()
    post.setRawAttributes({ id: 10, title: 'Hello' })
    ;(user as any)._relations = { latest_post: post }

    const obj = user.toObject()
    expect(obj).not.toHaveProperty('password')
    expect(obj).toHaveProperty('latest_post')
    expect(obj.latest_post).toEqual({ id: 10, title: 'Hello' })
  })

  test('makeHidden can hide a relation', () => {
    const user = new User()
    user.setRawAttributes({ id: 1, name: 'Alice' })

    const post = new (class extends Model {
      static override table = 'posts'
    })()
    post.setRawAttributes({ id: 10, title: 'Hello' })
    ;(user as any)._relations = { latest_post: post }

    const obj = user.makeHidden('latest_post').toObject()
    expect(obj).not.toHaveProperty('latest_post')
  })
})
