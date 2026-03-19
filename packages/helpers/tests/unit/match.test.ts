import { describe, expect, test } from 'bun:test'
import { match } from '../../src/match.ts'

describe('match', () => {
  test('matches exact value', () => {
    const result = match(200)
      .when(200, 'OK')
      .when(404, 'Not Found')
      .otherwise('Unknown')
    expect(result).toBe('OK')
  })

  test('matches array of values', () => {
    const result = match(404)
      .when([200, 201], 'Success')
      .when([404, 410], 'Gone')
      .otherwise('Unknown')
    expect(result).toBe('Gone')
  })

  test('matches predicate function', () => {
    const result = match(500)
      .when((code) => code >= 500, 'Server Error')
      .otherwise('Client Error')
    expect(result).toBe('Server Error')
  })

  test('executes result function lazily', () => {
    let called = false
    match(1)
      .when(1, () => { called = true; return 'one' })
      .otherwise('other')
    expect(called).toBe(true)
  })

  test('does not execute non-matching result functions', () => {
    let called = false
    match(2)
      .when(1, () => { called = true; return 'one' })
      .otherwise('other')
    expect(called).toBe(false)
  })

  test('otherwise returns default when no match', () => {
    const result = match(999)
      .when(1, 'one')
      .when(2, 'two')
      .otherwise('default')
    expect(result).toBe('default')
  })

  test('otherwise with function', () => {
    const result = match(999)
      .when(1, 'one')
      .otherwise(() => 'computed default')
    expect(result).toBe('computed default')
  })

  test('exhaustive throws when no match', () => {
    expect(() => {
      match(999)
        .when(1, 'one')
        .exhaustive()
    }).toThrow('No match found')
  })

  test('exhaustive returns matched value', () => {
    const result = match(1)
      .when(1, 'one')
      .exhaustive()
    expect(result).toBe('one')
  })

  test('first match wins', () => {
    const result = match(1)
      .when(1, 'first')
      .when(1, 'second')
      .otherwise('default')
    expect(result).toBe('first')
  })
})
