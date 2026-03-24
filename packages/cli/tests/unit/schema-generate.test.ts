import { describe, test, expect } from 'bun:test'
import { GenerateSchemaCommand } from '../../src/commands/GenerateSchemaCommand.ts'
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const tmpDir = '/tmp/mantiq-schema-test-' + Date.now()

function setup(migrations: Record<string, string>) {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  mkdirSync(join(tmpDir, 'database/migrations'), { recursive: true })
  mkdirSync(join(tmpDir, 'app/Models'), { recursive: true })
  for (const [name, content] of Object.entries(migrations)) {
    writeFileSync(join(tmpDir, 'database/migrations', name), content)
  }
}

function cleanup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
}

describe('schema:generate', () => {
  test('generates interface from create migration', async () => {
    setup({
      '001_create_users_table.ts': `
import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'

export default class extends Migration {
  override async up(schema: SchemaBuilder) {
    await schema.create('users', (t) => {
      t.id()
      t.string('name', 100)
      t.string('email', 255).unique()
      t.integer('age').nullable()
      t.boolean('is_active')
      t.json('meta').nullable()
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder) {
    await schema.dropIfExists('users')
  }
}`,
    })

    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('export interface UsersSchema')
    expect(output).toContain('id: number')
    expect(output).toContain('name: string')
    expect(output).toContain('email: string')
    expect(output).toContain('age: number | null')
    expect(output).toContain('is_active: boolean')
    expect(output).toContain('meta: Record<string, any> | null')
    expect(output).toContain('created_at: Date | null')
    expect(output).toContain('updated_at: Date | null')

    cleanup()
  })

  test('generates multiple interfaces from multiple migrations', async () => {
    setup({
      '001_create_users_table.ts': `
export default class extends Migration {
  override async up(schema) {
    await schema.create('users', (t) => {
      t.id()
      t.string('name')
      t.timestamps()
    })
  }
  override async down(schema) { await schema.dropIfExists('users') }
}`,
      '002_create_posts_table.ts': `
export default class extends Migration {
  override async up(schema) {
    await schema.create('posts', (t) => {
      t.id()
      t.string('title')
      t.text('body')
      t.integer('user_id')
      t.timestamps()
    })
  }
  override async down(schema) { await schema.dropIfExists('posts') }
}`,
    })

    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('export interface UsersSchema')
    expect(output).toContain('export interface PostsSchema')
    expect(output).toContain('title: string')
    expect(output).toContain('body: string')
    expect(output).toContain('user_id: number')

    cleanup()
  })

  test('handles softDeletes', async () => {
    setup({
      '001_create_items.ts': `
export default class extends Migration {
  override async up(schema) {
    await schema.create('items', (t) => {
      t.id()
      t.string('name')
      t.softDeletes()
      t.timestamps()
    })
  }
  override async down(schema) { await schema.dropIfExists('items') }
}`,
    })

    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('deleted_at: Date | null')

    cleanup()
  })

  test('output has auto-generated header', async () => {
    setup({
      '001_create_test.ts': `
export default class extends Migration {
  override async up(schema) {
    await schema.create('test', (t) => { t.id() })
  }
  override async down(schema) { await schema.dropIfExists('test') }
}`,
    })

    const cmd = new GenerateSchemaCommand()
    const origCwd = process.cwd()
    process.chdir(tmpDir)
    await cmd.handle({ command: 'schema:generate', args: [], flags: {} })
    process.chdir(origCwd)

    const output = readFileSync(join(tmpDir, 'app/Models/schemas.d.ts'), 'utf8')
    expect(output).toContain('Auto-generated from database migrations')
    expect(output).toContain('DO NOT EDIT')

    cleanup()
  })
})
