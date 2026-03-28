/**
 * A prompt template with variable interpolation.
 *
 * @example
 *   const prompt = new Prompt('Translate "{{text}}" to {{language}}')
 *   const rendered = prompt.with({ text: 'Hello', language: 'French' }).render()
 *   // → 'Translate "Hello" to French'
 */
export class Prompt {
  private variables: Record<string, string>

  constructor(
    private template: string,
    variables?: Record<string, string>,
    private version: string = '1.0',
  ) {
    this.variables = variables ?? {}
  }

  /** Set variables for interpolation. Returns this for chaining. */
  with(vars: Record<string, string>): this {
    this.variables = { ...this.variables, ...vars }
    return this
  }

  /** Render the template with current variables. */
  render(): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return this.variables[key] ?? `{{${key}}}`
    })
  }

  /** Get the raw template. */
  getTemplate(): string {
    return this.template
  }

  /** Get the version string. */
  getVersion(): string {
    return this.version
  }

  /** Get the current variables. */
  getVariables(): Record<string, string> {
    return { ...this.variables }
  }

  /** Extract variable names from the template. */
  getVariableNames(): string[] {
    const matches = this.template.matchAll(/\{\{(\w+)\}\}/g)
    return [...new Set([...matches].map((m) => m[1]!))]
  }
}
