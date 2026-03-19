import { describe, it, expect } from 'bun:test'
import { NullDriver } from '../../src/drivers/NullDriver.ts'

const driver = new NullDriver()

describe('NullDriver', () => {
  it('exists() always returns false', async () => {
    expect(await driver.exists('anything')).toBe(false)
  })

  it('get() always returns null', async () => {
    expect(await driver.get('anything')).toBeNull()
  })

  it('getBytes() always returns null', async () => {
    expect(await driver.getBytes('anything')).toBeNull()
  })

  it('put() does not throw', async () => {
    await driver.put('file.txt', 'content')
    // Still returns null after put
    expect(await driver.get('file.txt')).toBeNull()
  })

  it('delete() returns true', async () => {
    expect(await driver.delete('anything')).toBe(true)
  })

  it('files() returns empty array', async () => {
    expect(await driver.files()).toEqual([])
  })

  it('directories() returns empty array', async () => {
    expect(await driver.directories()).toEqual([])
  })

  it('getVisibility() returns public', async () => {
    expect(await driver.getVisibility('anything')).toBe('public')
  })
})
