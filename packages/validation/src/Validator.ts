import { ValidationError } from '@mantiq/core'
import type { Rule, ValidationContext } from './contracts/Rule.ts'
import type { PresenceVerifier } from './contracts/PresenceVerifier.ts'
import { builtinRules } from './rules/builtin.ts'

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedRule {
  name: string
  params: string[]
  rule?: Rule
}

export type RuleDefinition = string | (string | Rule)[]

// ── Validator ────────────────────────────────────────────────────────────────

export class Validator {
  private _errors: Record<string, string[]> = {}
  private _validated: Record<string, any> = {}
  private _hasRun = false
  private _presenceVerifier: PresenceVerifier | null = null
  private _stopOnFirstFailure = false

  private static _extensions: Record<string, Rule> = {}

  constructor(
    private readonly _data: Record<string, any>,
    private readonly _rules: Record<string, RuleDefinition>,
    private readonly _customMessages: Record<string, string> = {},
    private readonly _customAttributes: Record<string, string> = {},
  ) {}

  // ── Configuration ─────────────────────────────────────────────────────────

  setPresenceVerifier(verifier: PresenceVerifier): this {
    this._presenceVerifier = verifier
    return this
  }

  stopOnFirstFailure(stop = true): this {
    this._stopOnFirstFailure = stop
    return this
  }

  // ── Run ───────────────────────────────────────────────────────────────────

  async validate(): Promise<Record<string, any>> {
    await this.run()
    if (Object.keys(this._errors).length > 0) {
      throw new ValidationError(this._errors)
    }
    return this._validated
  }

  async fails(): Promise<boolean> {
    await this.run()
    return Object.keys(this._errors).length > 0
  }

  async passes(): Promise<boolean> {
    return !(await this.fails())
  }

  errors(): Record<string, string[]> {
    return { ...this._errors }
  }

  validated(): Record<string, any> {
    return { ...this._validated }
  }

  // ── Static extensions ─────────────────────────────────────────────────────

  static extend(name: string, rule: Rule): void {
    Validator._extensions[name] = rule
  }

  static resetExtensions(): void {
    Validator._extensions = {}
  }

  // ── Private: orchestration ────────────────────────────────────────────────

  private async run(): Promise<void> {
    if (this._hasRun) return
    this._hasRun = true
    this._errors = {}
    this._validated = {}

    for (const [fieldPattern, ruleSet] of Object.entries(this._rules)) {
      const fields = this.expandField(fieldPattern)
      for (const field of fields) {
        await this.validateField(field, ruleSet)
        if (this._stopOnFirstFailure && this._errors[field]?.length) break
      }
      if (this._stopOnFirstFailure && Object.keys(this._errors).length > 0) break
    }
  }

  private async validateField(field: string, ruleSet: RuleDefinition): Promise<void> {
    const rules = this.parseRules(ruleSet)
    const value = this.getValue(field)

    // Pre-scan for meta rules
    let bail = false
    let isNullable = false
    let isSometimes = false
    for (const r of rules) {
      if (r.name === 'bail') bail = true
      if (r.name === 'nullable') isNullable = true
      if (r.name === 'sometimes') isSometimes = true
    }

    // sometimes: skip if field not present in data
    if (isSometimes && !this.hasField(field)) return

    // nullable: if value is null/undefined, accept it and skip remaining rules
    if (isNullable && (value === null || value === undefined)) {
      this.setValidated(field, value)
      return
    }

    let hasError = false
    for (const parsed of rules) {
      if (parsed.name === 'bail' || parsed.name === 'nullable' || parsed.name === 'sometimes') continue

      const result = await this.runRule(parsed, value, field)
      if (typeof result === 'string') {
        this.addError(field, result, parsed)
        hasError = true
        if (bail) break
      }
    }

    if (!hasError) {
      this.setValidated(field, value)
    }
  }

  // ── Private: rule execution ───────────────────────────────────────────────

  private async runRule(parsed: ParsedRule, value: any, field: string): Promise<boolean | string> {
    const rule = parsed.rule
      ?? Validator._extensions[parsed.name]
      ?? builtinRules[parsed.name]

    if (!rule) {
      throw new Error(`Validation rule [${parsed.name}] is not defined.`)
    }

    const context: ValidationContext = {
      validator: this,
      presenceVerifier: this._presenceVerifier,
    }

    return rule.validate(value, field, this._data, parsed.params, context)
  }

  // ── Private: parsing ──────────────────────────────────────────────────────

  private parseRules(ruleSet: RuleDefinition): ParsedRule[] {
    if (typeof ruleSet === 'string') {
      return ruleSet.split('|').map((s) => this.parseRuleString(s))
    }
    return ruleSet.map((r) => {
      if (typeof r === 'string') return this.parseRuleString(r)
      return { name: r.name, params: [], rule: r }
    })
  }

  private parseRuleString(rule: string): ParsedRule {
    const colonIndex = rule.indexOf(':')
    if (colonIndex === -1) return { name: rule.trim(), params: [] }
    const name = rule.slice(0, colonIndex).trim()
    const paramStr = rule.slice(colonIndex + 1)
    return { name, params: paramStr.split(',') }
  }

  // ── Private: field expansion (wildcards) ──────────────────────────────────

  private expandField(pattern: string): string[] {
    if (!pattern.includes('*')) return [pattern]
    return this.expandWildcard(pattern.split('.'), this._data, '')
  }

  private expandWildcard(segments: string[], data: any, prefix: string): string[] {
    if (segments.length === 0) {
      // Remove trailing dot
      return prefix.length > 0 ? [prefix.slice(0, -1)] : ['']
    }

    const [head, ...rest] = segments

    if (head === '*') {
      if (Array.isArray(data)) {
        const results: string[] = []
        for (let i = 0; i < data.length; i++) {
          results.push(...this.expandWildcard(rest, data[i], `${prefix}${i}.`))
        }
        return results
      }
      if (data && typeof data === 'object') {
        const results: string[] = []
        for (const key of Object.keys(data)) {
          results.push(...this.expandWildcard(rest, data[key], `${prefix}${key}.`))
        }
        return results
      }
      return []
    }

    const next = data?.[head!]
    return this.expandWildcard(rest, next, `${prefix}${head}.`)
  }

  // ── Private: data access ──────────────────────────────────────────────────

  private getValue(field: string): any {
    return field.split('.').reduce((obj, key) => {
      if (obj === null || obj === undefined) return undefined
      if (Array.isArray(obj) && /^\d+$/.test(key)) return obj[Number(key)]
      return obj[key]
    }, this._data as any)
  }

  private hasField(field: string): boolean {
    const parts = field.split('.')
    let current: any = this._data
    for (const part of parts) {
      if (current === null || current === undefined) return false
      if (typeof current !== 'object') return false
      if (Array.isArray(current)) {
        if (!/^\d+$/.test(part)) return false
        if (Number(part) >= current.length) return false
        current = current[Number(part)]
      } else {
        if (!(part in current)) return false
        current = current[part]
      }
    }
    return true
  }

  private setValidated(field: string, value: any): void {
    const parts = field.split('.')
    let target = this._validated
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]!
      const nextKey = parts[i + 1]!
      if (!(key in target)) {
        target[key] = /^\d+$/.test(nextKey) ? [] : {}
      }
      target = target[key]
    }
    target[parts[parts.length - 1]!] = value
  }

  // ── Private: error messages ───────────────────────────────────────────────

  private addError(field: string, message: string, parsed: ParsedRule): void {
    // Custom message lookup: 'field.rule' > 'rule'
    const customMessage = this._customMessages[`${field}.${parsed.name}`]
      ?? this._customMessages[parsed.name]

    const finalMessage = customMessage
      ? this.replaceMessagePlaceholders(customMessage, field, parsed)
      : message

    if (!this._errors[field]) this._errors[field] = []
    this._errors[field].push(finalMessage)
  }

  private replaceMessagePlaceholders(message: string, field: string, parsed: ParsedRule): string {
    const attribute = this._customAttributes[field] ?? field.replace(/[_.]/g, ' ')
    let result = message.replace(/:attribute/g, attribute)
    // Replace positional params: :0, :1, etc.
    for (let i = 0; i < parsed.params.length; i++) {
      result = result.replace(new RegExp(`:${i}`, 'g'), parsed.params[i]!)
    }
    return result
  }
}
