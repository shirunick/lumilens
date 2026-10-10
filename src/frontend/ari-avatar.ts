import { escapeHtml } from './html'

export function createAriAvatarEl(
  dataUrl: string | null,
  className = 'll-avatar',
): HTMLElement {
  if (dataUrl) {
    const img = document.createElement('img')
    img.className = className
    img.src = dataUrl
    img.alt = 'Ari'
    return img
  }
  const ph = document.createElement('div')
  ph.className = `${className} ll-avatar-placeholder`
  ph.textContent = 'A'
  ph.setAttribute('aria-label', 'Ari')
  return ph
}

export function renderMarkdownLite(text: string): string {
  const esc = escapeHtml(text)
  const withHeadings = esc.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  const parts = withHeadings.split(/\n{2,}/)
  return parts
    .map((p) => {
      if (p.startsWith('<h2>')) return p.replace(/\n/g, '<br>')
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}
