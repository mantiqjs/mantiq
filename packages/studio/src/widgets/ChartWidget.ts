import { Widget } from './Widget.ts'

export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'area'

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor: string | undefined
  borderColor: string | undefined
}

export abstract class ChartWidget extends Widget {
  protected _heading: string | undefined = undefined
  protected _chartType: ChartType = 'line'
  protected _description: string | undefined = undefined

  override type(): string {
    return 'chart'
  }

  heading(heading: string): this {
    this._heading = heading
    return this
  }

  chartType(type: ChartType): this {
    this._chartType = type
    return this
  }

  description(description: string): this {
    this._description = description
    return this
  }

  abstract getDatasets(): ChartDataset[]

  abstract getLabels(): string[]

  override getData(): Record<string, unknown> {
    return {
      datasets: this.getDatasets(),
      labels: this.getLabels(),
    }
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      heading: this._heading,
      chartType: this._chartType,
      description: this._description,
      datasets: this.getDatasets(),
      labels: this.getLabels(),
    }
  }
}
