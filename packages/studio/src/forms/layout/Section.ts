import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export class Section implements Serializable {
  protected _heading: string | undefined = undefined
  protected _description: string | undefined = undefined
  protected _schema: FormComponent[] = []
  protected _collapsible: boolean = false
  protected _collapsed: boolean = false
  protected _aside: boolean = false
  protected _icon: string | undefined = undefined

  protected constructor() {}

  static make(): Section {
    return new Section()
  }

  heading(heading: string): this {
    this._heading = heading
    return this
  }

  description(description: string): this {
    this._description = description
    return this
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  collapsible(collapsible: boolean = true): this {
    this._collapsible = collapsible
    return this
  }

  collapsed(collapsed: boolean = true): this {
    this._collapsed = collapsed
    return this
  }

  aside(aside: boolean = true): this {
    this._aside = aside
    return this
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'section',
      heading: this._heading,
      description: this._description,
      schema: this._schema.map((c) => c.toSchema()),
      collapsible: this._collapsible,
      collapsed: this._collapsed,
      aside: this._aside,
      icon: this._icon,
    }
  }
}
