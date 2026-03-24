import { describe, it, expect, beforeEach } from 'bun:test'
import { MetricsCollector } from '../../src/metrics/MetricsCollector.ts'

let metrics: MetricsCollector

beforeEach(() => {
  metrics = new MetricsCollector()
})

describe('MetricsCollector', () => {
  describe('counters', () => {
    it('increments by 1 by default', () => {
      metrics.increment('http.requests')
      metrics.increment('http.requests')
      expect(metrics.getCounter('http.requests')).toBe(2)
    })

    it('increments by a custom value', () => {
      metrics.increment('http.requests', 5)
      expect(metrics.getCounter('http.requests')).toBe(5)
    })

    it('supports tags', () => {
      metrics.increment('http.requests', 1, { method: 'GET' })
      metrics.increment('http.requests', 1, { method: 'POST' })
      metrics.increment('http.requests', 1, { method: 'GET' })

      expect(metrics.getCounter('http.requests', { method: 'GET' })).toBe(2)
      expect(metrics.getCounter('http.requests', { method: 'POST' })).toBe(1)
    })

    it('returns 0 for unknown counters', () => {
      expect(metrics.getCounter('unknown')).toBe(0)
    })
  })

  describe('gauges', () => {
    it('sets and gets gauge values', () => {
      metrics.gauge('memory.rss', 100)
      expect(metrics.getGauge('memory.rss')).toBe(100)

      metrics.gauge('memory.rss', 200)
      expect(metrics.getGauge('memory.rss')).toBe(200)
    })

    it('returns 0 for unknown gauges', () => {
      expect(metrics.getGauge('unknown')).toBe(0)
    })
  })

  describe('histograms', () => {
    it('computes percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        metrics.observe('latency', i)
      }

      expect(metrics.percentile('latency', 50)).toBe(50)
      expect(metrics.percentile('latency', 95)).toBe(95)
      expect(metrics.percentile('latency', 99)).toBe(99)
    })

    it('returns 0 for empty histogram', () => {
      expect(metrics.percentile('empty', 50)).toBe(0)
    })

    it('counts observations', () => {
      metrics.observe('latency', 10)
      metrics.observe('latency', 20)
      metrics.observe('latency', 30)
      expect(metrics.histogramCount('latency')).toBe(3)
    })

    it('computes average', () => {
      metrics.observe('latency', 10)
      metrics.observe('latency', 20)
      metrics.observe('latency', 30)
      expect(metrics.histogramAvg('latency')).toBe(20)
    })
  })

  describe('reset', () => {
    it('clears all metrics', () => {
      metrics.increment('counter', 5)
      metrics.gauge('gauge', 100)
      metrics.observe('histogram', 50)

      metrics.reset()

      expect(metrics.getCounter('counter')).toBe(0)
      expect(metrics.getGauge('gauge')).toBe(0)
      expect(metrics.histogramCount('histogram')).toBe(0)
    })
  })

  describe('flush', () => {
    it('preserves counters when store write fails', async () => {
      const failingStore = {
        insertMetric: async () => { throw new Error('write failed') },
      } as any
      metrics.setStore(failingStore)

      metrics.increment('http.requests', 10)
      await metrics.flush()

      // Counters should NOT be cleared because the write failed
      expect(metrics.getCounter('http.requests')).toBe(10)
    })

    it('clears counters after successful write', async () => {
      const successStore = {
        insertMetric: async () => {},
      } as any
      metrics.setStore(successStore)

      metrics.increment('http.requests', 5)
      await metrics.flush()

      expect(metrics.getCounter('http.requests')).toBe(0)
    })
  })
})
