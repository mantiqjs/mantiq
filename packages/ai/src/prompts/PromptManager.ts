import { Prompt } from './Prompt.ts'

/**
 * Registry for named, versioned prompt templates.
 *
 * @example
 *   const prompts = new PromptManager()
 *   prompts.register('translate', new Prompt('Translate "{{text}}" to {{language}}', {}, '1.0'))
 *   prompts.register('translate', new Prompt('You are a translator. Translate: {{text}} → {{language}}', {}, '2.0'))
 *
 *   const latest = prompts.get('translate')
 *   const v1 = prompts.get('translate', '1.0')
 */
export class PromptManager {
  private prompts = new Map<string, Prompt[]>()

  /** Register a prompt under a name. Multiple versions are supported. */
  register(name: string, prompt: Prompt): void {
    const versions = this.prompts.get(name) ?? []
    versions.push(prompt)
    this.prompts.set(name, versions)
  }

  /** Get a prompt by name and optional version. Returns the latest version by default. */
  get(name: string, version?: string): Prompt {
    const versions = this.prompts.get(name)
    if (!versions || versions.length === 0) {
      throw new Error(`Prompt "${name}" not found.`)
    }

    if (version) {
      const match = versions.find((p) => p.getVersion() === version)
      if (!match) throw new Error(`Prompt "${name}" version "${version}" not found.`)
      return match
    }

    return versions[versions.length - 1]!
  }

  /** Check if a prompt exists. */
  has(name: string): boolean {
    return this.prompts.has(name) && this.prompts.get(name)!.length > 0
  }

  /** List all registered prompts. */
  list(): { name: string; version: string; template: string }[] {
    const result: { name: string; version: string; template: string }[] = []
    for (const [name, versions] of this.prompts) {
      for (const prompt of versions) {
        result.push({ name, version: prompt.getVersion(), template: prompt.getTemplate() })
      }
    }
    return result
  }

  /** Remove all versions of a named prompt. */
  remove(name: string): void {
    this.prompts.delete(name)
  }

  /** Clear all prompts. */
  clear(): void {
    this.prompts.clear()
  }
}
