/**
 * Base Enum class — Laravel-style backed enums for TypeScript.
 *
 * @example
 *   class UserStatus extends Enum {
 *     static Active = new UserStatus('active')
 *     static Inactive = new UserStatus('inactive')
 *     static Banned = new UserStatus('banned')
 *   }
 *
 *   UserStatus.from('active')     // → UserStatus.Active
 *   UserStatus.values()           // → ['active', 'inactive', 'banned']
 *   UserStatus.cases()            // → [Active, Inactive, Banned]
 *   UserStatus.Active.value       // → 'active'
 *   UserStatus.Active.label       // → 'Active'
 *   UserStatus.Active.is(status)  // → boolean
 */
export class Enum {
  readonly value: string | number

  constructor(value: string | number) {
    this.value = value
  }

  /** Human-readable label — derived from the static property name. */
  get label(): string {
    const ctor = this.constructor as typeof Enum
    for (const [key, val] of Object.entries(ctor)) {
      if (val === this) {
        // Convert PascalCase/camelCase to spaced: 'InProgress' → 'In Progress'
        return key.replace(/([a-z])([A-Z])/g, '$1 $2')
      }
    }
    return String(this.value)
  }

  /** Check if this enum equals another value (enum instance, string, or number). */
  is(other: Enum | string | number): boolean {
    if (other instanceof Enum) return this.value === other.value
    return this.value === other
  }

  /** Check if this enum does NOT equal another value. */
  isNot(other: Enum | string | number): boolean {
    return !this.is(other)
  }

  /** String representation — returns the raw value. */
  toString(): string {
    return String(this.value)
  }

  /** JSON serialization — returns the raw value. */
  toJSON(): string | number {
    return this.value
  }

  // ── Static methods (called on the subclass) ────────────────────────────

  /** Get all enum instances. */
  static cases(): Enum[] {
    return Object.values(this).filter((v) => v instanceof Enum)
  }

  /** Get all raw values. */
  static values(): (string | number)[] {
    return this.cases().map((c) => c.value)
  }

  /** Get all labels. */
  static labels(): string[] {
    return this.cases().map((c) => c.label)
  }

  /** Get an enum instance from a raw value. Throws if not found. */
  static from(value: string | number): Enum {
    const found = this.tryFrom(value)
    if (!found) throw new Error(`"${value}" is not a valid ${this.name} value. Valid: ${this.values().join(', ')}`)
    return found
  }

  /** Get an enum instance from a raw value. Returns null if not found. */
  static tryFrom(value: string | number): Enum | null {
    return this.cases().find((c) => c.value === value) ?? null
  }

  /** Check if a value is valid for this enum. */
  static has(value: string | number): boolean {
    return this.values().includes(value)
  }

  /** Get a map of value → label for select dropdowns, etc. */
  static options(): Array<{ value: string | number; label: string }> {
    return this.cases().map((c) => ({ value: c.value, label: c.label }))
  }
}
