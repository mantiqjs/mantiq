/**
 * Inline SVG chart helpers — pure SVG, no dependencies.
 */

export function sparkline(values: number[], options: {
  width?: number
  height?: number
  color?: string
} = {}): string {
  const { width = 100, height = 28, color = 'var(--accent)' } = options

  if (values.length < 2) return ''

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const pad = 2

  const points = values.map((v, i) => {
    const x = i * step
    const y = pad + (height - 2 * pad) * (1 - (v - min) / range)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const line = `M${points.join(' L')}`
  const fill = `${line} L${width},${height} L0,${height} Z`

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
    <path d="${fill}" fill="${color}" fill-opacity=".08"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

/**
 * Full-width area chart with x-axis labels and optional second series.
 */
export function areaChart(series: {
  label: string
  values: number[]
  color: string
}[], labels: string[], options: {
  height?: number
} = {}): string {
  const { height = 140 } = options
  if (series.length === 0 || series[0]!.values.length === 0) {
    return `<div class="empty">No data yet.</div>`
  }

  const allVals = series.flatMap((s) => s.values)
  const max = Math.max(...allVals, 1)
  const count = series[0]!.values.length
  const w = 600
  const padT = 8
  const padB = 24
  const chartH = height - padB - padT

  function toPoints(values: number[]): string {
    return values.map((v, i) => {
      const x = count === 1 ? w / 2 : (i / (count - 1)) * w
      const y = padT + chartH * (1 - v / max)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  const paths = series.map((s) => {
    const pts = toPoints(s.values)
    const first = s.values.length === 1 ? `${w / 2},${padT + chartH}` : `0,${padT + chartH}`
    const last = s.values.length === 1 ? `${w / 2},${padT + chartH}` : `${w},${padT + chartH}`
    return `
      <path d="M${first} L${pts} L${last} Z" fill="${s.color}" fill-opacity=".08"/>
      <path d="M${pts}" fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  }).join('')

  // X-axis labels (show ~6 evenly spaced)
  const labelStep = Math.max(1, Math.floor(count / 6))
  const xLabels = labels
    .map((l, i) => {
      if (i % labelStep !== 0 && i !== count - 1) return ''
      const x = count === 1 ? w / 2 : (i / (count - 1)) * w
      return `<text x="${x.toFixed(1)}" y="${height - 4}" text-anchor="middle" font-size="10" fill="var(--fg-3)">${l}</text>`
    })
    .join('')

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map((pct) => {
    const y = padT + chartH * (1 - pct)
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`
  }).join('')

  // Legend
  const legend = series.map((s) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:14px">
      <span style="width:8px;height:8px;border-radius:2px;background:${s.color}"></span>
      <span class="sm dim">${s.label}</span>
    </span>`
  ).join('')

  return `<div style="margin-bottom:4px">${legend}</div>
    <svg width="100%" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="display:block">
      ${gridLines}
      ${paths}
      ${xLabels}
    </svg>`
}

/**
 * Line chart — no fill, just stroked lines with dots at data points.
 */
export function lineChart(series: {
  label: string
  values: number[]
  color: string
}[], labels: string[], options: {
  height?: number
} = {}): string {
  const { height = 160 } = options
  if (series.length === 0 || series[0]!.values.length === 0) {
    return `<div class="empty">No data yet.</div>`
  }

  const allVals = series.flatMap((s) => s.values)
  const max = Math.max(...allVals, 1)
  const count = series[0]!.values.length
  const w = 600
  const padT = 12
  const padB = 24
  const padR = 4
  const chartH = height - padB - padT

  function toXY(values: number[]): Array<[number, number]> {
    return values.map((v, i) => {
      const x = count === 1 ? w / 2 : (i / (count - 1)) * (w - padR)
      const y = padT + chartH * (1 - v / max)
      return [x, y]
    })
  }

  const paths = series.map((s) => {
    const xy = toXY(s.values)
    const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const dots = xy
      .filter((_, i) => {
        // Show dots sparsely if many points
        if (count <= 30) return true
        const step = Math.max(1, Math.floor(count / 30))
        return i % step === 0 || i === count - 1
      })
      .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${s.color}"/>`)
      .join('')
    return `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}`
  }).join('')

  // X-axis labels (~8 evenly spaced)
  const labelStep = Math.max(1, Math.floor(count / 8))
  const xLabels = labels
    .map((l, i) => {
      if (i % labelStep !== 0 && i !== count - 1) return ''
      const x = count === 1 ? w / 2 : (i / (count - 1)) * (w - padR)
      return `<text x="${x.toFixed(1)}" y="${height - 4}" text-anchor="middle" font-size="10" fill="var(--fg-3)">${l}</text>`
    })
    .join('')

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const y = padT + chartH * (1 - pct)
    const val = Math.round(max * pct)
    return `<text x="${w + 2}" y="${y.toFixed(1)}" text-anchor="start" dominant-baseline="middle" font-size="9" fill="var(--fg-3)">${val}</text>`
  }).join('')

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map((pct) => {
    const y = padT + chartH * (1 - pct)
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`
  }).join('')

  // Baseline
  const baseline = `<line x1="0" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="var(--border)" stroke-width="0.5"/>`

  // Legend
  const legend = series.map((s) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:14px">
      <span style="width:10px;height:2px;border-radius:1px;background:${s.color}"></span>
      <span class="sm dim">${s.label}</span>
    </span>`
  ).join('')

  return `<div style="margin-bottom:6px">${legend}</div>
    <svg width="100%" viewBox="0 0 ${w + 30} ${height}" preserveAspectRatio="xMidYMid meet" style="display:block">
      ${baseline}
      ${gridLines}
      ${paths}
      ${xLabels}
      ${yLabels}
    </svg>`
}

export function barChart(items: Array<{ label: string; value: number; color?: string }>, options: {
  maxWidth?: number
} = {}): string {
  const { maxWidth = 180 } = options
  if (items.length === 0) return ''
  const maxVal = Math.max(...items.map((i) => i.value), 1)

  return items
    .map((item) => {
      const w = Math.max(2, (item.value / maxVal) * maxWidth)
      const c = item.color ?? 'var(--accent)'
      return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
        <span class="sm" style="width:70px;text-align:right;color:var(--fg-3)">${item.label}</span>
        <div style="width:${w}px;height:6px;background:${c};border-radius:3px"></div>
        <span class="sm mono">${item.value}</span>
      </div>`
    })
    .join('\n')
}

export function ringChart(value: number, total: number, options: {
  size?: number
  color?: string
  label?: string
} = {}): string {
  const { size = 64, color = 'var(--accent)', label } = options

  const pct = total > 0 ? value / total : 0
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  return `<div style="text-align:center">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="5"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="round"/>
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
        font-size="13" font-weight="600" fill="var(--fg-0)">${(pct * 100).toFixed(0)}%</text>
    </svg>
    ${label ? `<div class="sm dim" style="margin-top:2px">${label}</div>` : ''}
  </div>`
}
