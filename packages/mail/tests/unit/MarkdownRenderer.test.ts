import { describe, test, expect } from 'bun:test'
import { renderMarkdown } from '../../src/markdown/MarkdownRenderer.ts'
import { renderButton, renderPanel, renderTable, wrapInLayout } from '../../src/markdown/theme.ts'

describe('renderMarkdown', () => {
  // ── Layout wrapping ─────────────────────────────────────────────────────────

  test('wraps content in an HTML email layout', () => {
    const html = renderMarkdown('Hello world')

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
    expect(html).toContain('Hello world')
  })

  test('uses appName option in layout', () => {
    const html = renderMarkdown('Hello', { appName: 'MyApp' })

    expect(html).toContain('MyApp')
  })

  test('uses default appName "MantiqJS" when not specified', () => {
    const html = renderMarkdown('Hello')

    expect(html).toContain('MantiqJS')
  })

  // ── Headings ────────────────────────────────────────────────────────────────

  test('renders h1 heading', () => {
    const html = renderMarkdown('# Welcome')

    expect(html).toContain('<h1')
    expect(html).toContain('Welcome')
    expect(html).toContain('</h1>')
  })

  test('renders h2 heading', () => {
    const html = renderMarkdown('## Section')

    expect(html).toContain('<h2')
    expect(html).toContain('Section')
    expect(html).toContain('</h2>')
  })

  test('renders h3 heading', () => {
    const html = renderMarkdown('### Subsection')

    expect(html).toContain('<h3')
    expect(html).toContain('Subsection')
    expect(html).toContain('</h3>')
  })

  // ── Paragraphs ─────────────────────────────────────────────────────────────

  test('renders plain text as a paragraph', () => {
    const html = renderMarkdown('This is a paragraph.')

    expect(html).toContain('<p')
    expect(html).toContain('This is a paragraph.')
    expect(html).toContain('</p>')
  })

  // ── Inline formatting ──────────────────────────────────────────────────────

  test('renders bold text', () => {
    const html = renderMarkdown('This is **bold** text.')

    expect(html).toContain('<strong>bold</strong>')
  })

  test('renders italic text', () => {
    const html = renderMarkdown('This is *italic* text.')

    expect(html).toContain('<em>italic</em>')
  })

  test('renders inline code', () => {
    const html = renderMarkdown('Use `npm install` to install.')

    expect(html).toContain('<code')
    expect(html).toContain('npm install')
    expect(html).toContain('</code>')
  })

  test('renders links', () => {
    const html = renderMarkdown('Visit [Google](https://google.com) for more.')

    expect(html).toContain('<a href="https://google.com"')
    expect(html).toContain('Google')
    expect(html).toContain('</a>')
  })

  // ── Lists ─────────────────────────────────────────────────────────────────

  test('renders unordered list', () => {
    const html = renderMarkdown('- Item one\n- Item two\n- Item three')

    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('Item one')
    expect(html).toContain('Item two')
    expect(html).toContain('Item three')
    expect(html).toContain('</ul>')
  })

  test('renders ordered list', () => {
    const html = renderMarkdown('1. First\n2. Second\n3. Third')

    expect(html).toContain('<ol')
    expect(html).toContain('<li')
    expect(html).toContain('First')
    expect(html).toContain('Second')
    expect(html).toContain('Third')
    expect(html).toContain('</ol>')
  })

  // ── Blockquote ──────────────────────────────────────────────────────────────

  test('renders blockquote', () => {
    const html = renderMarkdown('> This is a quote')

    expect(html).toContain('<blockquote')
    expect(html).toContain('This is a quote')
    expect(html).toContain('</blockquote>')
  })

  // ── Horizontal rule ─────────────────────────────────────────────────────────

  test('renders horizontal rule', () => {
    const html = renderMarkdown('---')

    expect(html).toContain('<hr')
  })

  // ── Button component ───────────────────────────────────────────────────────

  test('renders button component', () => {
    const html = renderMarkdown('[button url="https://example.com"]Click Me[/button]')

    expect(html).toContain('https://example.com')
    expect(html).toContain('Click Me')
    expect(html).toContain('<a')
  })

  // ── Panel component ────────────────────────────────────────────────────────

  test('renders panel component', () => {
    const html = renderMarkdown('[panel]\nThis is panel content\n[/panel]')

    expect(html).toContain('This is panel content')
    // Panel renders within a table cell with panel class
    expect(html).toContain('email-panel')
  })

  // ── Mixed content ───────────────────────────────────────────────────────────

  test('renders mixed markdown content', () => {
    const md = `# Title

This is a **paragraph** with *emphasis*.

- List item one
- List item two

> A blockquote

---

Done.`

    const html = renderMarkdown(md)

    expect(html).toContain('<h1')
    expect(html).toContain('<strong>paragraph</strong>')
    expect(html).toContain('<em>emphasis</em>')
    expect(html).toContain('<ul')
    expect(html).toContain('<blockquote')
    expect(html).toContain('<hr')
    expect(html).toContain('Done.')
  })
})

describe('theme helpers', () => {
  test('wrapInLayout() wraps HTML in email template', () => {
    const html = wrapInLayout('<p>Content</p>')

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<p>Content</p>')
    expect(html).toContain('MantiqJS')
  })

  test('wrapInLayout() with custom appName', () => {
    const html = wrapInLayout('<p>Content</p>', { appName: 'CustomApp' })

    expect(html).toContain('CustomApp')
  })

  test('renderButton() creates a styled link button', () => {
    const html = renderButton('https://example.com', 'Click')

    expect(html).toContain('https://example.com')
    expect(html).toContain('Click')
    expect(html).toContain('<a')
    expect(html).toContain('border-radius')
  })

  test('renderPanel() creates a styled panel', () => {
    const html = renderPanel('Panel content')

    expect(html).toContain('Panel content')
    expect(html).toContain('email-panel')
  })

  test('renderTable() creates a styled table', () => {
    const html = renderTable(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']])

    expect(html).toContain('<thead>')
    expect(html).toContain('<tbody>')
    expect(html).toContain('Name')
    expect(html).toContain('Age')
    expect(html).toContain('Alice')
    expect(html).toContain('30')
    expect(html).toContain('Bob')
    expect(html).toContain('25')
  })

  test('renderButton() escapes HTML in text', () => {
    const html = renderButton('https://example.com', '<script>alert("xss")</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('renderTable() escapes HTML in cells', () => {
    const html = renderTable(['Col'], [['<b>bold</b>']])

    expect(html).not.toContain('<b>bold</b>')
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })
})
