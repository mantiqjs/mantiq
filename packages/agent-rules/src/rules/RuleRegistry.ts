import type { DetectedPackage } from './PackageDetector.ts'

export interface RuleSection {
  /** Section identifier */
  readonly id: string
  /** Human-readable title */
  readonly title: string
  /** Package names this section requires (empty = always include) */
  readonly requires: string[]
  /** Generate markdown content for this section */
  render(packages: DetectedPackage[]): string
}

export interface BuiltRules {
  /** All rendered sections in order */
  sections: { id: string; title: string; content: string }[]
  /** Packages that were detected as installed */
  installedPackages: string[]
}

/**
 * Collects rule sections and builds the final rules content,
 * filtering sections based on which packages are installed.
 */
export class RuleRegistry {
  private sections: RuleSection[] = []

  add(section: RuleSection): this {
    this.sections.push(section)
    return this
  }

  build(packages: DetectedPackage[]): BuiltRules {
    const installed = new Set(packages.filter((p) => p.installed).map((p) => p.name))

    const rendered = this.sections
      .filter((section) => {
        if (section.requires.length === 0) return true
        return section.requires.every((req) => installed.has(req))
      })
      .map((section) => ({
        id: section.id,
        title: section.title,
        content: section.render(packages),
      }))

    return {
      sections: rendered,
      installedPackages: [...installed],
    }
  }
}
