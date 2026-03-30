import { describe, it, expect, beforeAll } from 'bun:test'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PackageDetector } from '../../src/rules/PackageDetector.ts'
import { RuleRegistry } from '../../src/rules/RuleRegistry.ts'
import { OverviewSection } from '../../src/rules/sections/OverviewSection.ts'
import { CommandsSection } from '../../src/rules/sections/CommandsSection.ts'
import { BaseClassSection } from '../../src/rules/sections/BaseClassSection.ts'
import { ImportMapSection } from '../../src/rules/sections/ImportMapSection.ts'
import { FilePlacementSection } from '../../src/rules/sections/FilePlacementSection.ts'
import { PatternsSection } from '../../src/rules/sections/PatternsSection.ts'
import { TestingSection } from '../../src/rules/sections/TestingSection.ts'
import { AntiPatternsSection } from '../../src/rules/sections/AntiPatternsSection.ts'
import { AuthSection } from '../../src/rules/sections/AuthSection.ts'
import { DatabaseSection } from '../../src/rules/sections/DatabaseSection.ts'
import { QueueSection } from '../../src/rules/sections/QueueSection.ts'
import { MailSection } from '../../src/rules/sections/MailSection.ts'
import { AISection } from '../../src/rules/sections/AISection.ts'
import { StudioSection } from '../../src/rules/sections/StudioSection.ts'
import { ClaudeFormat } from '../../src/formats/ClaudeFormat.ts'
import { CursorFormat } from '../../src/formats/CursorFormat.ts'
import { CopilotFormat } from '../../src/formats/CopilotFormat.ts'
import { WindsurfFormat } from '../../src/formats/WindsurfFormat.ts'
import type { DetectedPackage } from '../../src/rules/PackageDetector.ts'

// ── PackageDetector ─────────────────────────────────────────────────────────

describe('PackageDetector', () => {
  const tmpDir = join(import.meta.dir, '../../.tmp-test')

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  it('detects installed @mantiq/* packages', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { '@mantiq/core': '^0.7.0', '@mantiq/database': '^0.7.0' },
      devDependencies: { '@mantiq/testing': '^0.7.0' },
    }))

    const detector = new PackageDetector()
    const packages = detector.detect(tmpDir)

    const core = packages.find((p) => p.name === 'core')
    expect(core?.installed).toBe(true)
    expect(core?.version).toBe('^0.7.0')

    const database = packages.find((p) => p.name === 'database')
    expect(database?.installed).toBe(true)

    const testing = packages.find((p) => p.name === 'testing')
    expect(testing?.installed).toBe(true)

    const auth = packages.find((p) => p.name === 'auth')
    expect(auth?.installed).toBe(false)
    expect(auth?.version).toBeUndefined()
  })

  it('returns empty for nonexistent path', () => {
    const detector = new PackageDetector()
    expect(detector.detect('/nonexistent')).toEqual([])
  })

  it('installed() returns only installed names', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { '@mantiq/core': '^0.7.0', '@mantiq/auth': '^0.7.0' },
    }))

    const detector = new PackageDetector()
    const names = detector.installed(tmpDir)
    expect(names).toContain('core')
    expect(names).toContain('auth')
    expect(names).not.toContain('database')
  })

  // cleanup
  it('cleanup', () => {
    rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ── RuleRegistry ────────────────────────────────────────────────────────────

describe('RuleRegistry', () => {
  const allPackages: DetectedPackage[] = [
    { name: 'core', installed: true, version: '^0.7.0' },
    { name: 'database', installed: true, version: '^0.7.0' },
    { name: 'auth', installed: true, version: '^0.7.0' },
    { name: 'testing', installed: true, version: '^0.7.0' },
    { name: 'queue', installed: false },
    { name: 'mail', installed: false },
  ]

  it('includes sections with no requirements', () => {
    const registry = new RuleRegistry()
    registry.add(new OverviewSection())
    const result = registry.build(allPackages)
    expect(result.sections.length).toBe(1)
    expect(result.sections[0]!.id).toBe('overview')
  })

  it('includes sections whose requirements are met', () => {
    const registry = new RuleRegistry()
    registry.add(new AuthSection())
    registry.add(new DatabaseSection())
    const result = registry.build(allPackages)
    expect(result.sections.length).toBe(2)
  })

  it('excludes sections whose requirements are not met', () => {
    const registry = new RuleRegistry()
    registry.add(new QueueSection())
    registry.add(new MailSection())
    const result = registry.build(allPackages)
    expect(result.sections.length).toBe(0)
  })

  it('reports installed packages', () => {
    const registry = new RuleRegistry()
    const result = registry.build(allPackages)
    expect(result.installedPackages).toContain('core')
    expect(result.installedPackages).toContain('database')
    expect(result.installedPackages).not.toContain('queue')
  })
})

// ── Rule Sections ───────────────────────────────────────────────────────────

describe('Rule Sections', () => {
  const fullPackages: DetectedPackage[] = [
    { name: 'core', installed: true, version: '^0.7.0' },
    { name: 'database', installed: true, version: '^0.7.0' },
    { name: 'auth', installed: true, version: '^0.7.0' },
    { name: 'validation', installed: true, version: '^0.7.0' },
    { name: 'cli', installed: true, version: '^0.7.0' },
    { name: 'testing', installed: true, version: '^0.7.0' },
    { name: 'queue', installed: true, version: '^0.7.0' },
    { name: 'mail', installed: true, version: '^0.7.0' },
    { name: 'ai', installed: true, version: '^0.7.0' },
    { name: 'studio', installed: true, version: '^0.7.0' },
    { name: 'notify', installed: true, version: '^0.7.0' },
    { name: 'agent-rules', installed: true, version: '^0.7.0' },
  ]

  it('OverviewSection mentions Bun and strict mode', () => {
    const content = new OverviewSection().render(fullPackages)
    expect(content).toContain('Bun')
    expect(content).toContain('noImplicitOverride')
    expect(content).toContain('override')
  })

  it('CommandsSection lists make:model', () => {
    const content = new CommandsSection().render(fullPackages)
    expect(content).toContain('make:model')
    expect(content).toContain('make:controller')
    expect(content).toContain('migrate')
  })

  it('CommandsSection includes AI commands when ai is installed', () => {
    const content = new CommandsSection().render(fullPackages)
    expect(content).toContain('ai:chat')
  })

  it('CommandsSection excludes AI commands when ai is not installed', () => {
    const noAi = fullPackages.map((p) => p.name === 'ai' ? { ...p, installed: false } : p)
    const content = new CommandsSection().render(noAi)
    expect(content).not.toContain('ai:chat')
  })

  it('BaseClassSection includes Factory signature with (index, fake)', () => {
    const content = new BaseClassSection().render(fullPackages)
    expect(content).toContain('definition(index: number, fake: Faker)')
    expect(content).not.toContain('definition(faker: Faker)')
  })

  it('BaseClassSection mentions override keyword', () => {
    const content = new BaseClassSection().render(fullPackages)
    expect(content).toContain('override')
    expect(content).toContain('noImplicitOverride')
  })

  it('BaseClassSection includes Job when queue installed', () => {
    const content = new BaseClassSection().render(fullPackages)
    expect(content).toContain('Job')
    expect(content).toContain('@mantiq/queue')
  })

  it('ImportMapSection has correct package mappings', () => {
    const content = new ImportMapSection().render(fullPackages)
    expect(content).toContain('`MantiqRequest`')
    expect(content).toContain('`@mantiq/core`')
    expect(content).toContain('`Model`')
    expect(content).toContain('`@mantiq/database`')
    expect(content).toContain('`FormRequest`')
    expect(content).toContain('`@mantiq/validation`')
  })

  it('FilePlacementSection has controller path', () => {
    const content = new FilePlacementSection().render(fullPackages)
    expect(content).toContain('app/Http/Controllers/')
    expect(content).toContain('app/Models/')
    expect(content).toContain('database/migrations/')
  })

  it('PatternsSection covers routing and responses', () => {
    const content = new PatternsSection().render(fullPackages)
    expect(content).toContain('MantiqResponse.json')
    expect(content).toContain('router.get')
    expect(content).toContain('env(')
  })

  it('AntiPatternsSection includes key pitfalls', () => {
    const content = new AntiPatternsSection().render(fullPackages)
    expect(content).toContain("(index: number, fake: Faker)")
    expect(content).toContain("next()")
    expect(content).toContain("require()")
    expect(content).toContain("override")
  })

  it('TestingSection mentions bun:test', () => {
    const content = new TestingSection().render(fullPackages)
    expect(content).toContain('bun:test')
    expect(content).toContain('TestCase')
  })

  it('AuthSection mentions AuthenticatableModel', () => {
    const content = new AuthSection().render(fullPackages)
    expect(content).toContain('AuthenticatableModel')
  })

  it('DatabaseSection has query examples', () => {
    const content = new DatabaseSection().render(fullPackages)
    expect(content).toContain('User.all()')
    expect(content).toContain('User.find(1)')
    expect(content).toContain('schema.create')
  })
})

// ── Formats ─────────────────────────────────────────────────────────────────

describe('Formats', () => {
  const registry = new RuleRegistry()
  registry
    .add(new OverviewSection())
    .add(new CommandsSection())
    .add(new BaseClassSection())
    .add(new AntiPatternsSection())
    .add(new AuthSection())
    .add(new TestingSection())

  const packages: DetectedPackage[] = [
    { name: 'core', installed: true, version: '^0.7.0' },
    { name: 'database', installed: true, version: '^0.7.0' },
    { name: 'auth', installed: true, version: '^0.7.0' },
    { name: 'testing', installed: true, version: '^0.7.0' },
    { name: 'cli', installed: true, version: '^0.7.0' },
  ]
  const rules = registry.build(packages)

  describe('ClaudeFormat', () => {
    const files = new ClaudeFormat().generate(rules)

    it('generates a single CLAUDE.md', () => {
      expect(files.length).toBe(1)
      expect(files[0]!.path).toBe('CLAUDE.md')
    })

    it('contains framework overview', () => {
      expect(files[0]!.content).toContain('MantiqJS')
      expect(files[0]!.content).toContain('Bun')
    })

    it('contains generated header', () => {
      expect(files[0]!.content).toContain('Generated by @mantiq/agent-rules')
    })
  })

  describe('CursorFormat', () => {
    const files = new CursorFormat().generate(rules)

    it('generates multiple .mdc files', () => {
      expect(files.length).toBeGreaterThan(1)
      for (const file of files) {
        expect(file.path).toStartWith('.cursor/rules/')
        expect(file.path).toEndWith('.mdc')
      }
    })

    it('includes frontmatter with description', () => {
      const overview = files.find((f) => f.path.includes('overview'))
      expect(overview).toBeDefined()
      expect(overview!.content).toContain('---')
      expect(overview!.content).toContain('description:')
      expect(overview!.content).toContain('alwaysApply:')
    })

    it('overview has alwaysApply: true', () => {
      const overview = files.find((f) => f.path.includes('overview'))
      expect(overview!.content).toContain('alwaysApply: true')
    })

    it('models file has globs for Models and database', () => {
      const models = files.find((f) => f.path.includes('models'))
      expect(models).toBeDefined()
      expect(models!.content).toContain('app/Models/**')
    })

    it('testing file has globs for tests', () => {
      const testing = files.find((f) => f.path.includes('testing'))
      expect(testing).toBeDefined()
      expect(testing!.content).toContain('tests/**')
    })
  })

  describe('CopilotFormat', () => {
    const files = new CopilotFormat().generate(rules)

    it('generates .github/copilot-instructions.md', () => {
      expect(files.length).toBe(1)
      expect(files[0]!.path).toBe('.github/copilot-instructions.md')
    })
  })

  describe('WindsurfFormat', () => {
    const files = new WindsurfFormat().generate(rules)

    it('generates .windsurfrules', () => {
      expect(files.length).toBe(1)
      expect(files[0]!.path).toBe('.windsurfrules')
    })
  })
})
