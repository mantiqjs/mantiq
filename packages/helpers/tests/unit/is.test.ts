import { describe, expect, test } from 'bun:test'
import { is } from '../../src/is.ts'

describe('is', () => {
  describe('type checks', () => {
    test('string', () => {
      expect(is.string('hello')).toBe(true)
      expect(is.string(42)).toBe(false)
    })

    test('number', () => {
      expect(is.number(42)).toBe(true)
      expect(is.number(NaN)).toBe(false)
    })

    test('integer', () => {
      expect(is.integer(42)).toBe(true)
      expect(is.integer(42.5)).toBe(false)
    })

    test('float', () => {
      expect(is.float(42.5)).toBe(true)
      expect(is.float(42)).toBe(false)
    })

    test('boolean', () => {
      expect(is.boolean(true)).toBe(true)
      expect(is.boolean(0)).toBe(false)
    })

    test('function', () => {
      expect(is.function(() => {})).toBe(true)
      expect(is.function(42)).toBe(false)
    })

    test('array', () => {
      expect(is.array([])).toBe(true)
      expect(is.array({})).toBe(false)
    })

    test('object', () => {
      expect(is.object({})).toBe(true)
      expect(is.object(null)).toBe(false)
    })

    test('plainObject', () => {
      expect(is.plainObject({})).toBe(true)
      expect(is.plainObject(new Date())).toBe(false)
      expect(is.plainObject([])).toBe(false)
    })

    test('date', () => {
      expect(is.date(new Date())).toBe(true)
      expect(is.date(new Date('invalid'))).toBe(false)
    })

    test('regExp', () => {
      expect(is.regExp(/test/)).toBe(true)
    })

    test('promise', () => {
      expect(is.promise(Promise.resolve())).toBe(true)
      expect(is.promise({ then: () => {} })).toBe(true)
    })

    test('map', () => {
      expect(is.map(new Map())).toBe(true)
    })

    test('set', () => {
      expect(is.set(new Set())).toBe(true)
    })

    test('error', () => {
      expect(is.error(new Error())).toBe(true)
    })
  })

  describe('nullish checks', () => {
    test('null', () => {
      expect(is.null(null)).toBe(true)
      expect(is.null(undefined)).toBe(false)
    })

    test('undefined', () => {
      expect(is.undefined(undefined)).toBe(true)
      expect(is.undefined(null)).toBe(false)
    })

    test('nullish', () => {
      expect(is.nullish(null)).toBe(true)
      expect(is.nullish(undefined)).toBe(true)
      expect(is.nullish('')).toBe(false)
    })

    test('defined', () => {
      expect(is.defined('hello')).toBe(true)
      expect(is.defined(0)).toBe(true)
      expect(is.defined(null)).toBe(false)
      expect(is.defined(undefined)).toBe(false)
    })
  })

  describe('emptiness', () => {
    test('empty', () => {
      expect(is.empty(null)).toBe(true)
      expect(is.empty(undefined)).toBe(true)
      expect(is.empty('')).toBe(true)
      expect(is.empty([])).toBe(true)
      expect(is.empty({})).toBe(true)
      expect(is.empty(new Map())).toBe(true)
      expect(is.empty(new Set())).toBe(true)
      expect(is.empty('hello')).toBe(false)
      expect(is.empty([1])).toBe(false)
      expect(is.empty(0)).toBe(false)
    })

    test('notEmpty', () => {
      expect(is.notEmpty('hello')).toBe(true)
      expect(is.notEmpty('')).toBe(false)
    })
  })

  describe('string format checks', () => {
    test('email', () => {
      expect(is.email('user@example.com')).toBe(true)
      expect(is.email('invalid')).toBe(false)
    })

    test('url', () => {
      expect(is.url('https://example.com')).toBe(true)
      expect(is.url('not-a-url')).toBe(false)
    })

    test('uuid', () => {
      expect(is.uuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(is.uuid('invalid')).toBe(false)
    })

    test('json', () => {
      expect(is.json('{"a":1}')).toBe(true)
      expect(is.json('invalid')).toBe(false)
    })

    test('numeric', () => {
      expect(is.numeric('42')).toBe(true)
      expect(is.numeric('-3.14')).toBe(true)
      expect(is.numeric('abc')).toBe(false)
    })

    test('alpha', () => {
      expect(is.alpha('abc')).toBe(true)
      expect(is.alpha('abc123')).toBe(false)
    })

    test('alphanumeric', () => {
      expect(is.alphanumeric('abc123')).toBe(true)
      expect(is.alphanumeric('abc-123')).toBe(false)
    })

    test('ip', () => {
      expect(is.ip('192.168.1.1')).toBe(true)
      expect(is.ip('999.999.999.999')).toBe(false)
    })
  })

  describe('number checks', () => {
    test('positive / negative / zero', () => {
      expect(is.positive(1)).toBe(true)
      expect(is.negative(-1)).toBe(true)
      expect(is.zero(0)).toBe(true)
    })

    test('between', () => {
      expect(is.between(5, 1, 10)).toBe(true)
      expect(is.between(15, 1, 10)).toBe(false)
    })

    test('even / odd', () => {
      expect(is.even(4)).toBe(true)
      expect(is.odd(3)).toBe(true)
    })

    test('finite', () => {
      expect(is.finite(42)).toBe(true)
      expect(is.finite(Infinity)).toBe(false)
    })

    test('nan', () => {
      expect(is.nan(NaN)).toBe(true)
      expect(is.nan(42)).toBe(false)
    })
  })
})
