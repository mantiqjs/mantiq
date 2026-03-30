import { Format, type GeneratedFile } from './Format.ts'
import type { BuiltRules } from '../rules/RuleRegistry.ts'

interface CursorRule {
  filename: string
  description: string
  globs?: string[]
  alwaysApply: boolean
  sectionIds: string[]
}

/**
 * Generates multiple .cursor/rules/*.mdc files for Cursor IDE.
 * Each file targets specific file patterns via glob triggers.
 */
export class CursorFormat extends Format {
  readonly name = 'cursor'
  readonly description = 'Cursor IDE (.cursor/rules/)'

  private readonly ruleMap: CursorRule[] = [
    {
      filename: 'mantiq-overview.mdc',
      description: 'MantiqJS framework overview and conventions',
      alwaysApply: true,
      sectionIds: ['overview', 'anti-patterns'],
    },
    {
      filename: 'mantiq-commands.mdc',
      description: 'MantiqJS CLI commands',
      alwaysApply: false,
      sectionIds: ['commands'],
    },
    {
      filename: 'mantiq-models.mdc',
      description: 'MantiqJS Model, Migration, Factory, Seeder patterns',
      globs: ['app/Models/**', 'database/**'],
      alwaysApply: false,
      sectionIds: ['base-classes', 'database'],
    },
    {
      filename: 'mantiq-controllers.mdc',
      description: 'MantiqJS Controller and routing patterns',
      globs: ['app/Http/Controllers/**', 'routes/**'],
      alwaysApply: false,
      sectionIds: ['patterns'],
    },
    {
      filename: 'mantiq-imports.mdc',
      description: 'MantiqJS import map and file placement',
      alwaysApply: false,
      sectionIds: ['import-map', 'file-placement'],
    },
    {
      filename: 'mantiq-testing.mdc',
      description: 'MantiqJS testing patterns',
      globs: ['tests/**'],
      alwaysApply: false,
      sectionIds: ['testing'],
    },
    {
      filename: 'mantiq-auth.mdc',
      description: 'MantiqJS authentication patterns',
      globs: ['app/Http/Middleware/**', 'app/Policies/**'],
      alwaysApply: false,
      sectionIds: ['auth'],
    },
  ]

  generate(rules: BuiltRules): GeneratedFile[] {
    const sectionMap = new Map(rules.sections.map((s) => [s.id, s]))
    const files: GeneratedFile[] = []

    for (const rule of this.ruleMap) {
      const matchedSections = rule.sectionIds
        .map((id) => sectionMap.get(id))
        .filter((s): s is NonNullable<typeof s> => s !== undefined)

      if (matchedSections.length === 0) continue

      let content = '---\n'
      content += `description: ${rule.description}\n`
      if (rule.globs) {
        content += `globs: ${JSON.stringify(rule.globs)}\n`
      }
      content += `alwaysApply: ${rule.alwaysApply}\n`
      content += '---\n\n'

      for (const section of matchedSections) {
        content += `## ${section.title}\n\n`
        content += section.content
        content += '\n\n'
      }

      files.push({
        path: `.cursor/rules/${rule.filename}`,
        content: content.trimEnd() + '\n',
      })
    }

    return files
  }
}
