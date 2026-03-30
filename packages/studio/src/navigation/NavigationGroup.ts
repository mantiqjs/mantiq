import type { NavigationGroupSchema, NavigationItemSchema } from '../schema/SchemaTypes.ts'
import type { Serializable } from '../contracts/Serializable.ts'
import { NavigationItem } from './NavigationItem.ts'

/**
 * A navigation group in the Studio sidebar.
 * Groups contain NavigationItems and can be collapsible.
 * Uses a builder pattern for fluent configuration.
 */
export class NavigationGroup implements Serializable {
  private _label: string
  private _icon: string | undefined = undefined
  private _items: NavigationItem[] = []
  private _collapsible: boolean = false

  private constructor(label: string) {
    this._label = label
  }

  static make(label: string): NavigationGroup {
    return new NavigationGroup(label)
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  items(items: NavigationItem[]): this {
    this._items = items
    return this
  }

  collapsible(collapsible: boolean = true): this {
    this._collapsible = collapsible
    return this
  }

  getLabel(): string {
    return this._label
  }

  getIcon(): string | undefined {
    return this._icon
  }

  getItems(): NavigationItem[] {
    return this._items
  }

  getCollapsible(): boolean {
    return this._collapsible
  }

  toSchema(): Record<string, unknown> {
    const schema: NavigationGroupSchema = {
      label: this._label,
      icon: this._icon,
      collapsible: this._collapsible,
      items: this._items.map(i => i.toSchema() as unknown as NavigationItemSchema),
    }
    return schema as unknown as Record<string, unknown>
  }
}
