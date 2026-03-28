import { describe, it, expect } from 'bun:test'
import {
  pagination,
  sqlHighlight,
  diffView,
  waterfallChart,
  emptyState,
  breadcrumbs,
  badge,
  statusBadge,
  escapeHtml,
  table,
} from '../../src/dashboard/shared/components.ts'

describe('components', () => {
  // ── pagination ───────────────────────────────────────────────────────

  describe('pagination()', () => {
    it('renders correct page count for multi-page results', () => {
      const html = pagination(150, 2, 50, '/heartbeat/requests')
      expect(html).toContain('class="pagination"')
      // Total pages = ceil(150/50) = 3
      expect(html).toContain('>1<')
      expect(html).toContain('>2<')
      expect(html).toContain('>3<')
    })

    it('returns empty string when total fits in one page', () => {
      const result = pagination(10, 1, 50, '/heartbeat/requests')
      expect(result).toBe('')
    })

    it('marks the current page as active', () => {
      const html = pagination(200, 3, 50, '/heartbeat/requests')
      expect(html).toContain('<span class="active">3</span>')
    })
  })

  // ── sqlHighlight ─────────────────────────────────────────────────────

  describe('sqlHighlight()', () => {
    it('colors SELECT, FROM, WHERE keywords', () => {
      const html = sqlHighlight('SELECT id FROM users WHERE active = 1')
      expect(html).toContain('<span class="sql-kw">SELECT</span>')
      expect(html).toContain('<span class="sql-kw">FROM</span>')
      expect(html).toContain('<span class="sql-kw">WHERE</span>')
    })

    it('highlights string literals', () => {
      const html = sqlHighlight("SELECT * FROM users WHERE name = 'Alice'")
      expect(html).toContain('sql-str')
      expect(html).toContain("'Alice'")
    })

    it('highlights numeric values', () => {
      const html = sqlHighlight('SELECT * FROM users LIMIT 10')
      expect(html).toContain('<span class="sql-num">10</span>')
    })
  })

  // ── diffView ─────────────────────────────────────────────────────────

  describe('diffView()', () => {
    it('shows old and new values with correct colors', () => {
      const html = diffView({
        name: { old: 'Alice', new: 'Bob' },
        age: { old: 25, new: 30 },
      })
      expect(html).toContain('Alice')
      expect(html).toContain('Bob')
      expect(html).toContain('#f87171') // old/red color
      expect(html).toContain('#34d399') // new/green color
      expect(html).toContain('name')
      expect(html).toContain('age')
    })

    it('returns "No changes" for null input', () => {
      expect(diffView(null)).toContain('No changes')
    })

    it('returns "No changes" for empty changes', () => {
      expect(diffView({})).toContain('No changes')
    })
  })

  // ── waterfallChart ───────────────────────────────────────────────────

  describe('waterfallChart()', () => {
    it('renders rows with correct widths', () => {
      const html = waterfallChart([
        { label: 'SQL Query', start: 0, end: 50, color: '#818cf8' },
        { label: 'Cache Hit', start: 50, end: 60, color: '#34d399' },
      ], 100)
      expect(html).toContain('waterfall')
      expect(html).toContain('SQL Query')
      expect(html).toContain('Cache Hit')
      expect(html).toContain('50.0ms')
      expect(html).toContain('10.0ms')
    })

    it('returns empty string for empty items', () => {
      expect(waterfallChart([], 100)).toBe('')
    })
  })

  // ── emptyState ───────────────────────────────────────────────────────

  describe('emptyState()', () => {
    it('renders title and description', () => {
      const html = emptyState('icon', 'No Requests', 'Start by sending some HTTP requests.')
      expect(html).toContain('empty-state')
      expect(html).toContain('No Requests')
      expect(html).toContain('Start by sending some HTTP requests.')
    })
  })

  // ── breadcrumbs ──────────────────────────────────────────────────────

  describe('breadcrumbs()', () => {
    it('renders links with separators for multi-item breadcrumbs', () => {
      const html = breadcrumbs([
        { label: 'Overview', href: '/heartbeat' },
        { label: 'Requests', href: '/heartbeat/requests' },
        { label: 'GET /users' },
      ])
      expect(html).toContain('breadcrumbs')
      expect(html).toContain('<a href="/heartbeat">Overview</a>')
      expect(html).toContain('<span class="sep">/</span>')
      expect(html).toContain('<a href="/heartbeat/requests">Requests</a>')
      // Last item should not be a link
      expect(html).toContain('<span>GET /users</span>')
    })

    it('renders single item without separator', () => {
      const html = breadcrumbs([{ label: 'Home' }])
      expect(html).toContain('Home')
      expect(html).not.toContain('sep')
    })
  })
})
