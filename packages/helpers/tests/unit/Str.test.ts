import { describe, expect, test } from 'bun:test'
import { Str, Stringable } from '../../src/Str.ts'

describe('Str', () => {
  describe('case conversion', () => {
    test('camel', () => {
      expect(Str.camel('foo_bar')).toBe('fooBar')
      expect(Str.camel('foo-bar')).toBe('fooBar')
      expect(Str.camel('Foo Bar')).toBe('fooBar')
    })

    test('snake', () => {
      expect(Str.snake('fooBar')).toBe('foo_bar')
      expect(Str.snake('FooBar')).toBe('foo_bar')
      expect(Str.snake('foo-bar')).toBe('foo_bar')
    })

    test('kebab', () => {
      expect(Str.kebab('fooBar')).toBe('foo-bar')
      expect(Str.kebab('FooBar')).toBe('foo-bar')
      expect(Str.kebab('foo_bar')).toBe('foo-bar')
    })

    test('pascal', () => {
      expect(Str.pascal('foo_bar')).toBe('FooBar')
      expect(Str.pascal('foo-bar')).toBe('FooBar')
      expect(Str.pascal('foo bar')).toBe('FooBar')
    })

    test('title', () => {
      expect(Str.title('hello world')).toBe('Hello World')
      expect(Str.title('foo_bar')).toBe('Foo Bar')
    })

    test('headline', () => {
      expect(Str.headline('fooBar')).toBe('Foo Bar')
      expect(Str.headline('foo_bar_baz')).toBe('Foo Bar Baz')
    })
  })

  describe('slug', () => {
    test('generates url-friendly slug', () => {
      expect(Str.slug('Hello World!')).toBe('hello-world')
      expect(Str.slug('Café Résumé')).toBe('cafe-resume')
    })

    test('custom separator', () => {
      expect(Str.slug('Hello World', '_')).toBe('hello_world')
    })
  })

  describe('pluralization', () => {
    test('plural', () => {
      expect(Str.plural('cat')).toBe('cats')
      expect(Str.plural('city')).toBe('cities')
      expect(Str.plural('bus')).toBe('buses')
      expect(Str.plural('leaf')).toBe('leaves')
    })

    test('singular', () => {
      expect(Str.singular('cats')).toBe('cat')
      expect(Str.singular('cities')).toBe('city')
      expect(Str.singular('buses')).toBe('bus')
    })
  })

  describe('random & ids', () => {
    test('random generates string of given length', () => {
      expect(Str.random(8).length).toBe(8)
      expect(Str.random(32).length).toBe(32)
      expect(Str.random()).toMatch(/^[A-Za-z0-9]{16}$/)
    })

    test('uuid generates valid v4 uuid', () => {
      expect(Str.isUuid(Str.uuid())).toBe(true)
    })

    test('ulid generates valid ulid', () => {
      expect(Str.isUlid(Str.ulid())).toBe(true)
      expect(Str.ulid().length).toBe(26)
    })
  })

  describe('mask', () => {
    test('masks from an index', () => {
      expect(Str.mask('1234567890', '*', 4)).toBe('1234******')
      expect(Str.mask('secret', '*', 0, 3)).toBe('***ret')
    })
  })

  describe('truncate & words', () => {
    test('truncate', () => {
      expect(Str.truncate('Hello World', 8)).toBe('Hello...')
      expect(Str.truncate('Short', 10)).toBe('Short')
    })

    test('words', () => {
      expect(Str.words('The quick brown fox jumps', 3)).toBe('The quick brown...')
    })
  })

  describe('contains / startsWith / endsWith', () => {
    test('contains', () => {
      expect(Str.contains('Hello World', 'World')).toBe(true)
      expect(Str.contains('Hello World', ['Foo', 'World'])).toBe(true)
      expect(Str.contains('Hello World', 'Nope')).toBe(false)
    })

    test('startsWith', () => {
      expect(Str.startsWith('Hello World', 'Hello')).toBe(true)
      expect(Str.startsWith('Hello World', ['Foo', 'Hello'])).toBe(true)
    })

    test('endsWith', () => {
      expect(Str.endsWith('Hello World', 'World')).toBe(true)
    })
  })

  describe('before / after / between', () => {
    test('before', () => {
      expect(Str.before('hello@world', '@')).toBe('hello')
    })

    test('beforeLast', () => {
      expect(Str.beforeLast('a/b/c', '/')).toBe('a/b')
    })

    test('after', () => {
      expect(Str.after('hello@world', '@')).toBe('world')
    })

    test('afterLast', () => {
      expect(Str.afterLast('a/b/c', '/')).toBe('c')
    })

    test('between', () => {
      expect(Str.between('[hello]', '[', ']')).toBe('hello')
    })
  })

  describe('is (pattern match)', () => {
    test('matches wildcard patterns', () => {
      expect(Str.is('foo*', 'foobar')).toBe(true)
      expect(Str.is('*bar', 'foobar')).toBe(true)
      expect(Str.is('foo', 'bar')).toBe(false)
    })
  })

  describe('wrap / unwrap / start / finish', () => {
    test('wrap', () => {
      expect(Str.wrap('hello', '"')).toBe('"hello"')
      expect(Str.wrap('hello', '<', '>')).toBe('<hello>')
    })

    test('unwrap', () => {
      expect(Str.unwrap('"hello"', '"')).toBe('hello')
    })

    test('start', () => {
      expect(Str.start('world', 'hello ')).toBe('hello world')
      expect(Str.start('hello world', 'hello ')).toBe('hello world')
    })

    test('finish', () => {
      expect(Str.finish('hello', '!')).toBe('hello!')
      expect(Str.finish('hello!', '!')).toBe('hello!')
    })
  })

  describe('password', () => {
    test('generates password of given length', () => {
      const pw = Str.password(16)
      expect(pw.length).toBe(16)
    })
  })

  describe('misc', () => {
    test('reverse', () => {
      expect(Str.reverse('hello')).toBe('olleh')
    })

    test('wordCount', () => {
      expect(Str.wordCount('hello world foo')).toBe(3)
    })

    test('replaceFirst', () => {
      expect(Str.replaceFirst('foo foo foo', 'foo', 'bar')).toBe('bar foo foo')
    })

    test('replaceLast', () => {
      expect(Str.replaceLast('foo foo foo', 'foo', 'bar')).toBe('foo foo bar')
    })
  })
})

describe('Stringable', () => {
  test('fluent chaining', () => {
    const result = Str.of('hello world').title().slug().toString()
    expect(result).toBe('hello-world')
  })

  test('when/unless', () => {
    const result = Str.of('hello')
      .when(true, (s) => s.upper())
      .unless(true, (s) => s.lower())
      .toString()
    expect(result).toBe('HELLO')
  })

  test('pipe and tap', () => {
    let tapped = ''
    const result = Str.of('hello')
      .pipe((v) => v.toUpperCase())
      .tap((v) => { tapped = v })
      .toString()
    expect(result).toBe('HELLO')
    expect(tapped).toBe('HELLO')
  })

  test('predicates', () => {
    const s = Str.of('Hello World')
    expect(s.contains('World')).toBe(true)
    expect(s.startsWith('Hello')).toBe(true)
    expect(s.endsWith('World')).toBe(true)
    expect(s.isEmpty()).toBe(false)
    expect(Str.of('').isEmpty()).toBe(true)
  })

  test('length', () => {
    expect(Str.of('hello').length).toBe(5)
  })
})
