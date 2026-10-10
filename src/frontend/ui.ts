import type { CharacterSummary } from '../shared/types'
import { createAriAvatarEl } from './ari-avatar'
import type { AriStore } from './ari-store'
import { icons } from './icons'
import { pick } from './phrases'

type Attrs = Record<
  string,
  string | number | boolean | null | undefined | ((e: Event) => void)
>
type Child = Node | string | null | undefined | false

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null || val === false) continue
    if (key === 'class') el.className = String(val)
    else if (key === 'text') el.textContent = String(val)
    else if (key === 'html') el.innerHTML = String(val)
    else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val as EventListener)
    } else if (val === true) el.setAttribute(key, '')
    else el.setAttribute(key, String(val))
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}

export function button(
  label: string,
  opts: {
    kind?: 'primary' | 'ghost'
    icon?: string
    onClick: (e: MouseEvent) => void
    title?: string
    disabled?: boolean
  },
): HTMLButtonElement {
  const cls = ['ll-btn']
  if (opts.kind) cls.push(`ll-btn-${opts.kind}`)
  const b = h('button', {
    type: 'button',
    class: cls.join(' '),
    title: opts.title,
    disabled: opts.disabled,
    onclick: (e) => opts.onClick(e as MouseEvent),
  })
  if (opts.icon) b.insertAdjacentHTML('beforeend', opts.icon)
  if (label) b.append(h('span', { text: label }))
  return b
}

export function iconButton(
  icon: string,
  title: string,
  onClick: () => void,
  className = 'll-icon-btn',
): HTMLButtonElement {
  return h('button', {
    type: 'button',
    class: className,
    title,
    'aria-label': title,
    html: icon,
    onclick: () => onClick(),
  })
}

export function chip(
  label: string,
  active: boolean,
  onToggle: (next: boolean) => void,
): HTMLButtonElement {
  const c = h('button', {
    type: 'button',
    class: 'll-chip',
    text: label,
    'data-active': active ? 'true' : 'false',
  })
  c.onclick = () => {
    const next = c.dataset.active !== 'true'
    c.dataset.active = next ? 'true' : 'false'
    onToggle(next)
  }
  return c
}

function artFallback(name: string, className: string): HTMLElement {
  return h('div', {
    class: `${className} ll-art-fallback`,
    text: (name || '?').trim().charAt(0).toUpperCase() || '?',
  })
}

export function art(
  char: Pick<CharacterSummary, 'name' | 'imageUrl'>,
  className: string,
): HTMLElement {
  if (!char.imageUrl) return artFallback(char.name, className)
  const img = h('img', {
    class: className,
    src: char.imageUrl,
    alt: '',
    loading: 'lazy',
    draggable: 'false',
  })
  img.onerror = () => img.replaceWith(artFallback(char.name, className))
  return img
}

export function loadingView(
  ari: AriStore,
  title: string,
  sub?: string,
): HTMLElement {
  const wrap = h('div', { class: 'll-loading' })
  wrap.append(
    h('div', { class: 'll-loading-avatar' }, [
      h('span', { class: 'll-loading-halo' }),
      createAriAvatarEl(ari.url, 'll-avatar ll-avatar-lg'),
    ]),
    h('div', { class: 'll-loading-title', text: title }),
    h('div', { class: 'll-shimmer' }, [h('span')]),
  )
  if (sub) wrap.append(h('div', { class: 'll-muted ll-center', text: sub }))
  return wrap
}

export function loadingFrom(
  ari: AriStore,
  lines: readonly { title: string; sub?: string }[],
): HTMLElement {
  const line = pick(lines)
  return loadingView(ari, line.title, line.sub)
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export function rowButton(opts: {
  icon: string
  title: string
  desc: string
  onClick: () => void
  variant: 'menu' | 'choice'
  chevron?: boolean
}): HTMLButtonElement {
  const menu = opts.variant === 'menu'
  return h(
    'button',
    {
      type: 'button',
      class: menu ? 'll-menu-item' : 'll-choice',
      onclick: () => opts.onClick(),
    },
    [
      h('span', { class: menu ? 'll-menu-icon' : 'll-choice-icon', html: opts.icon }),
      h('span', { class: menu ? 'll-menu-text' : undefined }, [
        h('div', { class: menu ? 'll-menu-title' : 'll-choice-title', text: opts.title }),
        h('div', { class: menu ? 'll-menu-desc' : 'll-choice-desc', text: opts.desc }),
      ]),
      opts.chevron
        ? h('span', { class: 'll-menu-chev', html: icons.chevronRight() })
        : null,
    ],
  )
}

export function collapsiblePanel(
  title: string,
  children: HTMLElement[],
  opts: { open?: boolean } = {},
): HTMLElement {
  const open = opts.open === true
  const panel = h('div', { class: 'll-card-panel ll-collapse' })
  panel.dataset.open = open ? 'true' : 'false'
  const head = h(
    'button',
    {
      type: 'button',
      class: 'll-collapse-head',
      'aria-expanded': open ? 'true' : 'false',
    },
    [
      h('span', { class: 'll-panel-title', text: title }),
      h('span', { class: 'll-collapse-chevron', html: icons.chevronRight(16) }),
    ],
  )
  const body = h('div', { class: 'll-collapse-body' }, children)
  head.addEventListener('click', () => {
    const next = panel.dataset.open !== 'true'
    panel.dataset.open = next ? 'true' : 'false'
    head.setAttribute('aria-expanded', next ? 'true' : 'false')
  })
  panel.append(head, body)
  return panel
}

export function switchRow(
  label: string,
  input: HTMLInputElement,
  hint?: string,
): HTMLLabelElement {
  const text = hint
    ? h('span', {}, [
        h('div', { class: 'll-switch-label', text: label }),
        h('div', { class: 'll-muted', text: hint }),
      ])
    : h('span', { text: label })
  return h('label', { class: 'll-switch-row' }, [text, input])
}

export function tagRow(tags: string[], max = 4): HTMLElement | null {
  if (!tags.length) return null
  return h(
    'div',
    { class: 'll-tags' },
    tags.slice(0, max).map((t) => h('span', { class: 'll-tag', text: t })),
  )
}
