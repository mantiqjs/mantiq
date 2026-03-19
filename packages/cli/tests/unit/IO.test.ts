import { describe, expect, test } from 'bun:test'
import { IO } from '../../src/IO.ts'

describe('IO', () => {
  test('green wraps text with ANSI green', () => {
    const io = new IO()
    const result = io.green('hello')
    expect(result).toContain('hello')
    expect(result).toContain('\x1b[32m')
    expect(result).toContain('\x1b[0m')
  })

  test('red wraps text with ANSI red', () => {
    const io = new IO()
    const result = io.red('error')
    expect(result).toContain('\x1b[31m')
  })

  test('yellow wraps text with ANSI yellow', () => {
    const io = new IO()
    const result = io.yellow('warn')
    expect(result).toContain('\x1b[33m')
  })

  test('cyan wraps text with ANSI cyan', () => {
    const io = new IO()
    const result = io.cyan('info')
    expect(result).toContain('\x1b[36m')
  })

  test('bold wraps text with ANSI bold', () => {
    const io = new IO()
    const result = io.bold('title')
    expect(result).toContain('\x1b[1m')
  })

  test('gray wraps text with ANSI dim gray', () => {
    const io = new IO()
    const result = io.gray('muted')
    expect(result).toContain('\x1b[90m')
  })
})
