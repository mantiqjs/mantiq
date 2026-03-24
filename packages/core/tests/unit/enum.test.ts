import { describe, test, expect } from 'bun:test'
import { Enum } from '../../src/support/Enum.ts'

class Color extends Enum {
  static Red = new Color('red')
  static Green = new Color('green')
  static Blue = new Color('blue')
}

class Priority extends Enum {
  static Low = new Priority(1)
  static Medium = new Priority(2)
  static High = new Priority(3)
}

class UserStatus extends Enum {
  static Active = new UserStatus('active')
  static Inactive = new UserStatus('inactive')
  static OnHold = new UserStatus('on_hold')
}

describe('Enum', () => {
  test('value returns the raw value', () => {
    expect(Color.Red.value).toBe('red')
    expect(Priority.High.value).toBe(3)
  })

  test('label derives from property name', () => {
    expect(Color.Red.label).toBe('Red')
    expect(Color.Green.label).toBe('Green')
    expect(UserStatus.OnHold.label).toBe('On Hold')
  })

  test('is() compares with enum instance', () => {
    expect(Color.Red.is(Color.Red)).toBe(true)
    expect(Color.Red.is(Color.Blue)).toBe(false)
  })

  test('is() compares with raw value', () => {
    expect(Color.Red.is('red')).toBe(true)
    expect(Color.Red.is('blue')).toBe(false)
    expect(Priority.High.is(3)).toBe(true)
    expect(Priority.High.is(1)).toBe(false)
  })

  test('isNot() is the inverse of is()', () => {
    expect(Color.Red.isNot('blue')).toBe(true)
    expect(Color.Red.isNot('red')).toBe(false)
  })

  test('toString() returns string value', () => {
    expect(String(Color.Red)).toBe('red')
    expect(String(Priority.High)).toBe('3')
  })

  test('toJSON() returns raw value', () => {
    expect(JSON.stringify({ color: Color.Red })).toBe('{"color":"red"}')
    expect(JSON.stringify({ priority: Priority.High })).toBe('{"priority":3}')
  })

  test('cases() returns all instances', () => {
    const cases = Color.cases()
    expect(cases.length).toBe(3)
    expect(cases).toContain(Color.Red)
    expect(cases).toContain(Color.Green)
    expect(cases).toContain(Color.Blue)
  })

  test('values() returns all raw values', () => {
    expect(Color.values()).toEqual(['red', 'green', 'blue'])
    expect(Priority.values()).toEqual([1, 2, 3])
  })

  test('labels() returns all labels', () => {
    expect(Color.labels()).toEqual(['Red', 'Green', 'Blue'])
    expect(UserStatus.labels()).toEqual(['Active', 'Inactive', 'On Hold'])
  })

  test('from() resolves by value', () => {
    expect(Color.from('red')).toBe(Color.Red)
    expect(Priority.from(2)).toBe(Priority.Medium)
  })

  test('from() throws on invalid value', () => {
    expect(() => Color.from('purple')).toThrow('"purple" is not a valid Color')
  })

  test('tryFrom() returns null on invalid value', () => {
    expect(Color.tryFrom('purple')).toBeNull()
    expect(Color.tryFrom('red')).toBe(Color.Red)
  })

  test('has() checks value existence', () => {
    expect(Color.has('red')).toBe(true)
    expect(Color.has('purple')).toBe(false)
    expect(Priority.has(3)).toBe(true)
    expect(Priority.has(99)).toBe(false)
  })

  test('options() returns value/label pairs', () => {
    const opts = Color.options()
    expect(opts).toEqual([
      { value: 'red', label: 'Red' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
    ])
  })

  test('enums are singletons', () => {
    expect(Color.from('red')).toBe(Color.Red)
    expect(Color.Red === Color.from('red')).toBe(true)
  })

  test('different enum classes are isolated', () => {
    expect(Color.values()).not.toEqual(Priority.values())
    expect(Color.cases().length).toBe(3)
    expect(Priority.cases().length).toBe(3)
  })
})
