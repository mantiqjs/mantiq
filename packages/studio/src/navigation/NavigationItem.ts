import type { NavigationItemSchema } from '../schema/SchemaTypes.ts'
import type { Serializable } from '../contracts/Serializable.ts'

/**
 * A single navigation item (link) in the Studio sidebar.
 * Uses a builder pattern for fluent configuration.
 */
export class NavigationItem implements Serializable {
  private _label: string
  private _icon: string | undefined = undefined
  private _url: string = ''
  private _badge: string | number | undefined = undefined
  private _badgeColor: string | undefined = undefined
  private _isActive: boolean = false
  private _children: NavigationItem[] = []

  private constructor(label: string) {
    this._label = label
  }

  static make(label: string): NavigationItem {
    return new NavigationItem(label)
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  url(url: string): this {
    this._url = url
    return this
  }

  badge(badge: string | number): this {
    this._badge = badge
    return this
  }

  badgeColor(color: string): this {
    this._badgeColor = color
    return this
  }

  active(isActive: boolean = true): this {
    this._isActive = isActive
    return this
  }

  children(items: NavigationItem[]): this {
    this._children = items
    return this
  }

  getLabel(): string {
    return this._label
  }

  getUrl(): string {
    return this._url
  }

  getIcon(): string | undefined {
    return this._icon
  }

  getBadge(): string | number | undefined {
    return this._badge
  }

  getBadgeColor(): string | undefined {
    return this._badgeColor
  }

  getIsActive(): boolean {
    return this._isActive
  }

  getChildren(): NavigationItem[] {
    return this._children
  }

  toSchema(): Record<string, unknown> {
    const schema: NavigationItemSchema = {
      label: this._label,
      icon: this._icon,
      url: this._url,
      badge: this._badge,
      badgeColor: this._badgeColor,
      isActive: this._isActive,
      children: this._children.map(c => c.toSchema() as unknown as NavigationItemSchema),
    }
    return schema as unknown as Record<string, unknown>
  }
}
