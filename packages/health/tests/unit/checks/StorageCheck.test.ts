import { describe, test, expect } from 'bun:test'
import { StorageCheck } from '../../../src/checks/StorageCheck.ts'
import { mkdirSync, rmdirSync, chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const tmpBase = join('/tmp', '__health_storage_test__')

describe('StorageCheck', () => {
  test('passes for /tmp (always writable)', async () => {
    const result = await new StorageCheck('/tmp').execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('storage')
    expect(result.meta?.writable).toBe(true)
    expect(result.meta?.path).toBe('/tmp')
  })

  test('fails for non-existent path that cannot be created', async () => {
    const result = await new StorageCheck('/proc/nonexistent/deeply/nested/path').execute()
    expect(result.status).toBe('critical')
  })

  test('reports path in metadata', async () => {
    const result = await new StorageCheck('/tmp').execute()
    expect(result.meta?.path).toBe('/tmp')
  })

  test('auto-creates directory if it does not exist', async () => {
    const testDir = join(tmpBase, `auto_create_${Date.now()}`)
    try {
      expect(existsSync(testDir)).toBe(false)
      const result = await new StorageCheck(testDir).execute()
      expect(result.status).toBe('ok')
      expect(existsSync(testDir)).toBe(true)
    } finally {
      try { rmdirSync(testDir, { recursive: true } as any) } catch {}
    }
  })

  test('defaults to ./storage path', async () => {
    // We cannot easily test this in /tmp, but we verify the constructor default
    const check = new StorageCheck()
    // The check will try ./storage relative to CWD — may or may not exist
    const result = await check.execute()
    // If the CWD/storage is writable, it will pass; otherwise fail — both are valid
    expect(['ok', 'critical']).toContain(result.status)
    expect(result.meta?.path).toBe('./storage')
  })

  test('fails for read-only directory', async () => {
    const readOnlyDir = join(tmpBase, `readonly_${Date.now()}`)
    try {
      mkdirSync(readOnlyDir, { recursive: true })
      chmodSync(readOnlyDir, 0o444) // read-only
      const result = await new StorageCheck(readOnlyDir).execute()
      expect(result.status).toBe('critical')
      expect(result.message).toContain('not writable')
    } finally {
      try { chmodSync(readOnlyDir, 0o755) } catch {}
      try { rmdirSync(readOnlyDir, { recursive: true } as any) } catch {}
    }
  })

  test('cleans up the test file after successful write', async () => {
    const testDir = join(tmpBase, `cleanup_${Date.now()}`)
    try {
      mkdirSync(testDir, { recursive: true })
      const result = await new StorageCheck(testDir).execute()
      expect(result.status).toBe('ok')
      // The health check file (.health-check-*) should have been deleted
      const { readdirSync } = require('node:fs')
      const remaining = readdirSync(testDir).filter((f: string) => f.startsWith('.health-check'))
      expect(remaining).toHaveLength(0)
    } finally {
      try { rmdirSync(testDir, { recursive: true } as any) } catch {}
    }
  })
})
