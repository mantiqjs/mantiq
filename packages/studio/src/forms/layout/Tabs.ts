import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export interface TabSchema {
  label: string
  icon: string | undefined
  badge: string | undefined
  schema: Record<string, unknown>[]
}

export class Tab implements Serializable {
  protected _label: string
  protected _icon: string | undefined = undefined
  protected _badge: string | undefined = undefined
  protected _schema: FormComponent[] = []

  protected constructor(label: string) {
    this._label = label
  }

  static make(label: string): Tab {
    return new Tab(label)
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  badge(badge: string): this {
    this._badge = badge
    return this
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      label: this._label,
      icon: this._icon,
      badge: this._badge,
      schema: this._schema.map((c) => c.toSchema()),
    }
  }
}

export class Tabs implements Serializable {
  protected _tabs: Tab[] = []

  protected constructor() {}

  static make(): Tabs {
    return new Tabs()
  }

  tabs(tabs: Tab[]): this {
    this._tabs = tabs
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'tabs',
      tabs: this._tabs.map((t) => t.toSchema()),
    }
  }
}
