import type { BuiltRules } from '../rules/RuleRegistry.ts'

export interface GeneratedFile {
  /** Path relative to project root */
  path: string
  /** File content */
  content: string
}

/**
 * Base class for output format implementations.
 * Each format knows how to transform built rules into
 * the correct file(s) for a specific AI coding agent.
 */
export abstract class Format {
  abstract readonly name: string
  abstract readonly description: string

  /** Generate file(s) from the built rules */
  abstract generate(rules: BuiltRules): GeneratedFile[]
}
