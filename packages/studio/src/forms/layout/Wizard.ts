import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export class WizardStep implements Serializable {
  protected _label: string
  protected _description: string | undefined = undefined
  protected _icon: string | undefined = undefined
  protected _schema: FormComponent[] = []

  protected constructor(label: string) {
    this._label = label
  }

  static make(label: string): WizardStep {
    return new WizardStep(label)
  }

  description(description: string): this {
    this._description = description
    return this
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      label: this._label,
      description: this._description,
      icon: this._icon,
      schema: this._schema.map((c) => c.toSchema()),
    }
  }
}

export class Wizard implements Serializable {
  protected _steps: WizardStep[] = []

  protected constructor() {}

  static make(): Wizard {
    return new Wizard()
  }

  steps(steps: WizardStep[]): this {
    this._steps = steps
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'wizard',
      steps: this._steps.map((s) => s.toSchema()),
    }
  }
}
