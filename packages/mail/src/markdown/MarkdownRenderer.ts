import { wrapInLayout, renderButton, renderPanel, type ThemeOptions } from './theme.ts'

/**
 * Converts markdown-like content to styled HTML email.
 *
 * Supports: headings, paragraphs, bold, italic, links, lists, code,
 * blockquotes, horizontal rules, and custom components:
 *   [button url="..."]text[/button]
 *   [panel]content[/panel]
 */
export function renderMarkdown(content: string, options: ThemeOptions = {}): string {
  const bodyHtml = markdownToHtml(content.trim())
  return wrapInLayout(bodyHtml, options)
}

function markdownToHtml(md: string): string {
  let html = ''
  const lines = md.split('\n')
  let i = 0
  let inList: 'ul' | 'ol' | null = null

  while (i < lines.length) {
    const line = lines[i]!
    const trimmed = line.trim()

    // Empty line — close list if open
    if (!trimmed) {
      if (inList) { html += `</${inList}>` ; inList = null }
      i++
      continue
    }

    // Custom components
    const buttonMatch = trimmed.match(/^\[button\s+url="([^"]+)"\](.*?)\[\/button\]$/)
    if (buttonMatch) {
      if (inList) { html += `</${inList}>`; inList = null }
      html += renderButton(buttonMatch[1]!, buttonMatch[2]!)
      i++
      continue
    }

    // Panel block (multi-line)
    if (trimmed === '[panel]') {
      if (inList) { html += `</${inList}>`; inList = null }
      const panelLines: string[] = []
      i++
      while (i < lines.length && lines[i]!.trim() !== '[/panel]') {
        panelLines.push(lines[i]!)
        i++
      }
      i++ // skip [/panel]
      html += renderPanel(inlineFormatting(panelLines.join('<br>')))
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      if (inList) { html += `</${inList}>`; inList = null }
      const level = headingMatch[1]!.length
      const text = inlineFormatting(headingMatch[2]!)
      const sizes: Record<number, string> = { 1: '24px', 2: '20px', 3: '17px', 4: '15px', 5: '14px', 6: '13px' }
      const mt = level <= 2 ? '28px' : '20px'
      html += `<h${level} class="email-text" style="margin:${mt} 0 8px;font-size:${sizes[level]};font-weight:700;line-height:1.3;color:#1a1a1a;">${text}</h${level}>`
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) { html += `</${inList}>`; inList = null }
      html += `<hr class="email-hr" style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">`
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      if (inList) { html += `</${inList}>`; inList = null }
      const quoteLines: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('> ')) {
        quoteLines.push(lines[i]!.trim().slice(2))
        i++
      }
      html += `<blockquote class="email-blockquote" style="margin:16px 0;padding:12px 20px;border-left:3px solid #e5e7eb;color:#6b7280;font-style:italic;">${inlineFormatting(quoteLines.join('<br>'))}</blockquote>`
      continue
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (inList !== 'ul') {
        if (inList) html += `</${inList}>`
        html += `<ul style="margin:12px 0;padding-left:24px;color:#1a1a1a;">`
        inList = 'ul'
      }
      html += `<li style="margin:4px 0;line-height:1.6;">${inlineFormatting(trimmed.replace(/^[-*+]\s+/, ''))}</li>`
      i++
      continue
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      if (inList !== 'ol') {
        if (inList) html += `</${inList}>`
        html += `<ol style="margin:12px 0;padding-left:24px;color:#1a1a1a;">`
        inList = 'ol'
      }
      html += `<li style="margin:4px 0;line-height:1.6;">${inlineFormatting(olMatch[2]!)}</li>`
      i++
      continue
    }

    // Paragraph (default)
    if (inList) { html += `</${inList}>`; inList = null }
    html += `<p class="email-text" style="margin:12px 0;line-height:1.65;color:#1a1a1a;">${inlineFormatting(trimmed)}</p>`
    i++
  }

  if (inList) html += `</${inList}>`

  return html
}

/** Process inline markdown: bold, italic, code, links */
function inlineFormatting(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="email-code" style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:13px;font-family:\'SF Mono\',ui-monospace,Menlo,monospace;color:#10b981;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="email-link" style="color:#10b981;text-decoration:underline;">$1</a>')
}
