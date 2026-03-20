/**
 * Responsive email base template.
 * - 600px max-width centered table layout (email-safe)
 * - Inline CSS (email clients strip <style> tags)
 * - Dark mode via @media (prefers-color-scheme: dark)
 * - Outlook-compatible button (VML fallback not included — uses padding trick)
 */

export interface ThemeOptions {
  appName?: string
  logoUrl?: string
}

const COLORS = {
  bg: '#ffffff',
  bgDark: '#1a1a1a',
  surface: '#f9fafb',
  surfaceDark: '#262626',
  text: '#1a1a1a',
  textDark: '#e5e5e5',
  muted: '#6b7280',
  mutedDark: '#9ca3af',
  accent: '#10b981',
  accentDark: '#34d399',
  border: '#e5e7eb',
  borderDark: '#374151',
  panelBg: '#f3f4f6',
  panelBgDark: '#1f2937',
} as const

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace"

export function wrapInLayout(bodyHtml: string, options: ThemeOptions = {}): string {
  const appName = options.appName ?? 'MantiqJS'

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escHtml(appName)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: ${COLORS.bgDark} !important; }
      .email-container { background-color: ${COLORS.bgDark} !important; }
      .email-content { background-color: ${COLORS.bgDark} !important; color: ${COLORS.textDark} !important; }
      .email-header { border-bottom-color: ${COLORS.borderDark} !important; }
      .email-footer { border-top-color: ${COLORS.borderDark} !important; color: ${COLORS.mutedDark} !important; }
      .email-text { color: ${COLORS.textDark} !important; }
      .email-muted { color: ${COLORS.mutedDark} !important; }
      .email-panel { background-color: ${COLORS.panelBgDark} !important; border-color: ${COLORS.borderDark} !important; }
      .email-hr { border-color: ${COLORS.borderDark} !important; }
      .email-code { background-color: ${COLORS.surfaceDark} !important; color: ${COLORS.accentDark} !important; }
      .email-link { color: ${COLORS.accentDark} !important; }
      .email-th { border-bottom-color: ${COLORS.borderDark} !important; color: ${COLORS.mutedDark} !important; }
      .email-td { border-bottom-color: ${COLORS.borderDark} !important; color: ${COLORS.textDark} !important; }
      .email-blockquote { border-left-color: ${COLORS.borderDark} !important; color: ${COLORS.mutedDark} !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-content { padding: 24px 20px !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:${COLORS.bg};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${COLORS.bg};">
          <!-- Header -->
          <tr>
            <td class="email-header" style="padding:20px 32px;border-bottom:1px solid ${COLORS.border};">
              <span style="font-size:15px;font-weight:600;color:${COLORS.text};letter-spacing:-0.02em;">${escHtml(appName)}</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="email-content" style="padding:32px;color:${COLORS.text};font-size:15px;line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="email-footer" style="padding:20px 32px;border-top:1px solid ${COLORS.border};font-size:12px;color:${COLORS.muted};line-height:1.6;">
              &copy; ${new Date().getFullYear()} ${escHtml(appName)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Component renderers ─────────────────────────────────────────────────────

export function renderButton(url: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${COLORS.accent};border-radius:6px;">
      <a href="${escHtml(url)}" target="_blank" class="email-link" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff !important;text-decoration:none;border-radius:6px;">${escHtml(text)}</a>
    </td>
  </tr>
</table>`
}

export function renderPanel(content: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
  <tr>
    <td class="email-panel" style="padding:16px 20px;background-color:${COLORS.panelBg};border:1px solid ${COLORS.border};border-radius:6px;font-size:14px;line-height:1.6;color:${COLORS.text};">
      ${content}
    </td>
  </tr>
</table>`
}

export function renderTable(headers: string[], rows: string[][]): string {
  const ths = headers.map(h =>
    `<th class="email-th" style="text-align:left;padding:8px 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${COLORS.muted};border-bottom:2px solid ${COLORS.border};">${escHtml(h)}</th>`
  ).join('')

  const trs = rows.map(row =>
    `<tr>${row.map(cell =>
      `<td class="email-td" style="padding:10px 12px;font-size:14px;color:${COLORS.text};border-bottom:1px solid ${COLORS.border};">${escHtml(cell)}</td>`
    ).join('')}</tr>`
  ).join('')

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border-collapse:collapse;">
  <thead><tr>${ths}</tr></thead>
  <tbody>${trs}</tbody>
</table>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
