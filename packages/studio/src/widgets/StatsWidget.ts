import type { Serializable } from '../contracts/Serializable.ts'
import { Widget } from './Widget.ts'

export interface StatTrend {
  direction: 'up' | 'down' | 'flat'
  value: string
}

export class Stat implements Serializable {
  protected _label: string
  protected _value: string | number
  protected _description: string | undefined = undefined
  protected _descriptionIcon: string | undefined = undefined
  protected _color: string | undefined = undefined
  protected _chart: number[] = []
  protected _trend: StatTrend | undefined = undefined

  protected constructor(label: string, value: string | number) {
    this._label = label
    this._value = value
  }

  static make(label: string, value: string | number): Stat {
    return new Stat(label, value)
  }

  description(description: string): this {
    this._description = description
    return this
  }

  descriptionIcon(icon: string): this {
    this._descriptionIcon = icon
    return this
  }

  color(color: string): this {
    this._color = color
    return this
  }

  chart(data: number[]): this {
    this._chart = data
    return this
  }

  trend(direction: 'up' | 'down' | 'flat', value: string): this {
    this._trend = { direction, value }
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      label: this._label,
      value: this._value,
      description: this._description,
      descriptionIcon: this._descriptionIcon,
      color: this._color,
      chart: this._chart,
      trend: this._trend,
    }
  }
}

export class StatsWidget extends Widget {
  protected _stats: Stat[] = []

  protected constructor() {
    super()
  }

  static make(): StatsWidget {
    return new StatsWidget()
  }

  override type(): string {
    return 'stats'
  }

  stats(stats: Stat[]): this {
    this._stats = stats
    return this
  }

  override getData(): Record<string, unknown> {
    return {
      stats: this._stats.map((s) => s.toSchema()),
    }
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      stats: this._stats.map((s) => s.toSchema()),
    }
  }
}
