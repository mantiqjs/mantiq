import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PackageDetector } from '../rules/PackageDetector.ts'
import { RuleRegistry } from '../rules/RuleRegistry.ts'
import { OverviewSection } from '../rules/sections/OverviewSection.ts'
import { CommandsSection } from '../rules/sections/CommandsSection.ts'
import { BaseClassSection } from '../rules/sections/BaseClassSection.ts'
import { ImportMapSection } from '../rules/sections/ImportMapSection.ts'
import { FilePlacementSection } from '../rules/sections/FilePlacementSection.ts'
import { PatternsSection } from '../rules/sections/PatternsSection.ts'
import { TestingSection } from '../rules/sections/TestingSection.ts'
import { AntiPatternsSection } from '../rules/sections/AntiPatternsSection.ts'
import { AuthSection } from '../rules/sections/AuthSection.ts'
import { DatabaseSection } from '../rules/sections/DatabaseSection.ts'
import { QueueSection } from '../rules/sections/QueueSection.ts'
import { MailSection } from '../rules/sections/MailSection.ts'
import { AISection } from '../rules/sections/AISection.ts'
import { StudioSection } from '../rules/sections/StudioSection.ts'
import { ClaudeFormat } from '../formats/ClaudeFormat.ts'
import { CursorFormat } from '../formats/CursorFormat.ts'
import { CopilotFormat } from '../formats/CopilotFormat.ts'
import { WindsurfFormat } from '../formats/WindsurfFormat.ts'
import type { Format, GeneratedFile } from '../formats/Format.ts'

// Inline minimal command base to avoid hard dependency on @mantiq/cli
interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean>
}

/**
 * Generate AI coding agent context files for this MantiqJS project.
 *
 * Usage: bun mantiq agent:generate [--format=claude|cursor|copilot|windsurf|all]
 */
export class AgentGenerateCommand {
  name = 'agent:generate'
  description = 'Generate AI coding agent context files (CLAUDE.md, .cursor/rules/, etc.)'
  usage = 'agent:generate [--format=claude|cursor|copilot|windsurf|all]'

  private readonly allFormats: Format[] = [
    new ClaudeFormat(),
    new CursorFormat(),
    new CopilotFormat(),
    new WindsurfFormat(),
  ]

  async handle(args: ParsedArgs): Promise<number> {
    const basePath = process.cwd()
    const formatFlag = (args.flags['format'] as string) || 'all'

    // 1. Detect installed packages
    const detector = new PackageDetector()
    const packages = detector.detect(basePath)
    const installed = packages.filter((p) => p.installed).map((p) => p.name)

    // 2. Build rules
    const registry = new RuleRegistry()
    registry
      .add(new OverviewSection())
      .add(new CommandsSection())
      .add(new BaseClassSection())
      .add(new ImportMapSection())
      .add(new FilePlacementSection())
      .add(new PatternsSection())
      .add(new DatabaseSection())
      .add(new AuthSection())
      .add(new TestingSection())
      .add(new QueueSection())
      .add(new MailSection())
      .add(new AISection())
      .add(new StudioSection())
      .add(new AntiPatternsSection())

    const rules = registry.build(packages)

    // 3. Load custom rules from rules/ directory
    const customRulesDir = join(basePath, 'rules')
    if (existsSync(customRulesDir)) {
      const files = readdirSync(customRulesDir).filter((f) => f.endsWith('.md')).sort()
      for (const file of files) {
        const content = readFileSync(join(customRulesDir, file), 'utf-8')
        const title = file.replace(/\.md$/, '').replace(/[-_]/g, ' ')
        rules.sections.push({ id: `custom-${file}`, title, content })
      }
    }

    // 4. Determine formats
    const formats = formatFlag === 'all'
      ? this.allFormats
      : this.allFormats.filter((f) => f.name === formatFlag)

    if (formats.length === 0) {
      console.error(`  \x1b[31mERROR\x1b[0m  Unknown format "${formatFlag}". Valid: claude, cursor, copilot, windsurf, all`)
      return 1
    }

    // 5. Generate and write files
    const allFiles: GeneratedFile[] = []
    for (const format of formats) {
      allFiles.push(...format.generate(rules))
    }

    for (const file of allFiles) {
      const fullPath = join(basePath, file.path)
      mkdirSync(dirname(fullPath), { recursive: true })
      await Bun.write(fullPath, file.content)
    }

    // 6. Report
    console.log(`\x1b[90m  INFO\x1b[0m  Detected ${installed.length} @mantiq/* packages`)
    for (const file of allFiles) {
      console.log(`\x1b[38;2;52;211;153m  DONE\x1b[0m  ${file.path}`)
    }

    return 0
  }
}
