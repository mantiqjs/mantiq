import { describe, it, expect } from 'bun:test'
import { sparkline, lineChart, areaChart, barChart, ringChart } from '../../src/dashboard/shared/charts.ts'

describe('charts', () => {
  // ── sparkline ────────────────────────────────────────────────────────

  describe('sparkline()', () => {
    it('returns SVG with viewBox for valid data', () => {
      const svg = sparkline([10, 20, 30, 40, 50])
      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox="0 0 100 28"')
      expect(svg).toContain('<path')
    })

    it('returns empty string for fewer than 2 values', () => {
      expect(sparkline([])).toBe('')
      expect(sparkline([42])).toBe('')
    })

    it('respects custom width, height, and color options', () => {
      const svg = sparkline([1, 2, 3], { width: 200, height: 40, color: '#ff0000' })
      expect(svg).toContain('viewBox="0 0 200 40"')
      expect(svg).toContain('stroke="#ff0000"')
    })
  })

  // ── lineChart ────────────────────────────────────────────────────────

  describe('lineChart()', () => {
    it('returns SVG with path elements for valid data', () => {
      const svg = lineChart(
        [{ label: 'Series A', values: [10, 20, 30], color: '#ff0000' }],
        ['a', 'b', 'c'],
      )
      expect(svg).toContain('<svg')
      expect(svg).toContain('<path')
      expect(svg).toContain('stroke="#ff0000"')
      expect(svg).toContain('Series A')
    })

    it('returns empty state for empty data', () => {
      const result = lineChart([], [])
      expect(result).toContain('No data yet')
    })

    it('returns empty state when series has empty values array', () => {
      const result = lineChart([{ label: 'Test', values: [], color: '#000' }], [])
      expect(result).toContain('No data yet')
    })

    it('renders dots at data points', () => {
      const svg = lineChart(
        [{ label: 'S', values: [5, 10, 15], color: '#aaa' }],
        ['a', 'b', 'c'],
      )
      expect(svg).toContain('<circle')
    })
  })

  // ── areaChart ────────────────────────────────────────────────────────

  describe('areaChart()', () => {
    it('returns SVG with filled path for valid data', () => {
      const svg = areaChart(
        [{ label: 'Requests', values: [5, 15, 25], color: '#00ff00' }],
        ['x', 'y', 'z'],
      )
      expect(svg).toContain('<svg')
      expect(svg).toContain('fill="#00ff00"')
      expect(svg).toContain('fill-opacity=".08"')
      expect(svg).toContain('Requests')
    })

    it('returns empty state for empty series', () => {
      const result = areaChart([], [])
      expect(result).toContain('No data yet')
    })

    it('renders grid lines', () => {
      const svg = areaChart(
        [{ label: 'A', values: [10, 20], color: '#0f0' }],
        ['x', 'y'],
      )
      expect(svg).toContain('<line')
    })
  })

  // ── barChart ─────────────────────────────────────────────────────────

  describe('barChart()', () => {
    it('returns HTML with styled divs for items', () => {
      const html = barChart([
        { label: 'GET', value: 100, color: '#818cf8' },
        { label: 'POST', value: 50 },
      ])
      expect(html).toContain('GET')
      expect(html).toContain('POST')
      expect(html).toContain('100')
      expect(html).toContain('50')
    })

    it('returns empty string for empty items', () => {
      expect(barChart([])).toBe('')
    })
  })

  // ── ringChart ────────────────────────────────────────────────────────

  describe('ringChart()', () => {
    it('returns SVG with circle and percentage text', () => {
      const svg = ringChart(75, 100, { label: 'Success' })
      expect(svg).toContain('<svg')
      expect(svg).toContain('<circle')
      expect(svg).toContain('75%')
      expect(svg).toContain('Success')
    })

    it('handles zero total gracefully', () => {
      const svg = ringChart(0, 0)
      expect(svg).toContain('<svg')
      expect(svg).toContain('0%')
    })
  })
})
