import { describe, expect, test } from 'bun:test'
import { parse } from '../../src/Parser.ts'

describe('Parser', () => {
  test('parses command name from argv', () => {
    const result = parse(['bun', 'mantiq', 'migrate'])
    expect(result.command).toBe('migrate')
  })

  test('defaults to help when no command provided', () => {
    const result = parse(['bun', 'mantiq'])
    expect(result.command).toBe('help')
  })

  test('parses positional arguments', () => {
    const result = parse(['bun', 'mantiq', 'make:model', 'User'])
    expect(result.command).toBe('make:model')
    expect(result.args).toEqual(['User'])
  })

  test('parses multiple positional arguments', () => {
    const result = parse(['bun', 'mantiq', 'seed', 'UserSeeder', 'extra'])
    expect(result.args).toEqual(['UserSeeder', 'extra'])
  })

  test('parses --key=value flags', () => {
    const result = parse(['bun', 'mantiq', 'make:migration', 'create_users', '--create=users'])
    expect(result.flags['create']).toBe('users')
  })

  test('parses --key value flags', () => {
    const result = parse(['bun', 'mantiq', 'serve', '--port', '8080'])
    expect(result.flags['port']).toBe('8080')
  })

  test('parses boolean --flag', () => {
    const result = parse(['bun', 'mantiq', 'migrate', '--force'])
    expect(result.flags['force']).toBe(true)
  })

  test('parses short -f flags', () => {
    const result = parse(['bun', 'mantiq', 'make:model', 'User', '-m', '-f', '-s'])
    expect(result.flags['m']).toBe(true)
    expect(result.flags['f']).toBe(true)
    expect(result.flags['s']).toBe(true)
  })

  test('parses mixed args and flags', () => {
    const result = parse(['bun', 'mantiq', 'make:controller', 'UserController', '--resource', '-v'])
    expect(result.command).toBe('make:controller')
    expect(result.args).toEqual(['UserController'])
    expect(result.flags['resource']).toBe(true)
    expect(result.flags['v']).toBe(true)
  })

  test('treats value after --flag as its value, not positional', () => {
    const result = parse(['bun', 'mantiq', 'cmd', '--table', 'users', 'extra'])
    expect(result.flags['table']).toBe('users')
    expect(result.args).toEqual(['extra'])
  })
})
