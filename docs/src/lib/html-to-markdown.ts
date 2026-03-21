/**
 * Converts rendered HTML doc content to Markdown.
 */
export function htmlToMarkdown(el: HTMLElement, pageTitle: string): string {
  const lines: string[] = [`# ${pageTitle}`, '']

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    const childText = () => Array.from(element.childNodes).map(processNode).join('')

    switch (tag) {
      case 'h2':
        lines.push('', `## ${element.textContent?.trim()}`, '')
        return ''
      case 'h3':
        lines.push('', `### ${element.textContent?.trim()}`, '')
        return ''
      case 'h4':
        lines.push('', `#### ${element.textContent?.trim()}`, '')
        return ''
      case 'p':
        lines.push(processInline(element), '')
        return ''
      case 'pre': {
        const code = element.querySelector('code')
        const lang = code?.className?.match(/language-(\w+)/)?.[1] ?? ''
        const text = code?.textContent?.trimEnd() ?? element.textContent?.trimEnd() ?? ''
        lines.push(`\`\`\`${lang}`, text, '```', '')
        return ''
      }
      case 'ul': {
        const items = element.querySelectorAll(':scope > li')
        items.forEach((li) => {
          lines.push(`- ${processInline(li)}`)
        })
        lines.push('')
        return ''
      }
      case 'ol': {
        const items = element.querySelectorAll(':scope > li')
        items.forEach((li, i) => {
          lines.push(`${i + 1}. ${processInline(li)}`)
        })
        lines.push('')
        return ''
      }
      case 'table': {
        const rows = element.querySelectorAll('tr')
        rows.forEach((row, i) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map(
            (c) => c.textContent?.trim() ?? '',
          )
          lines.push(`| ${cells.join(' | ')} |`)
          if (i === 0) {
            lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
          }
        })
        lines.push('')
        return ''
      }
      case 'hr':
        lines.push('---', '')
        return ''
      case 'div': {
        if (element.classList.contains('note')) {
          lines.push(`> **Note:** ${processInline(element)}`, '')
          return ''
        }
        if (element.classList.contains('warning')) {
          lines.push(`> **Warning:** ${processInline(element)}`, '')
          return ''
        }
        if (element.classList.contains('tip')) {
          lines.push(`> **Tip:** ${processInline(element)}`, '')
          return ''
        }
        Array.from(element.childNodes).forEach(processNode)
        return ''
      }
      default:
        Array.from(element.childNodes).forEach(processNode)
        return ''
    }
  }

  function processInline(el: Element): string {
    return Array.from(el.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        const element = node as HTMLElement
        const tag = element.tagName.toLowerCase()
        const text = element.textContent ?? ''

        if (tag === 'strong' || tag === 'b') return `**${text}**`
        if (tag === 'em' || tag === 'i') return `*${text}*`
        if (tag === 'code') return `\`${text}\``
        if (tag === 'a') {
          const href = element.getAttribute('href') ?? ''
          return `[${text}](${href})`
        }
        if (tag === 'br') return '\n'
        return processInline(element)
      })
      .join('')
  }

  Array.from(el.childNodes).forEach(processNode)

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
