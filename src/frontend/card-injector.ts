import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import type { AriStore } from './ari-store'
import type { LensRef } from './quick-view'

export const LENS_MARKER = 'data-lumilens-lens'

export type CardInjectorOptions = {
  ctx: SpindleFrontendContext
  ari: AriStore
  onOpenLens: (ref: LensRef) => void
}

export const CARD_ACTIONS_MOUNT = 'character_browser_card_actions'

const SCOPE_PREFIX = 'character-card:'
const SCOPE_SUFFIX = ':actions'

type DecoratorRenderCtx = {
  scope: string
  node: Element
  root: HTMLElement
}

type HostUiDecorators = {
  registerDomDecorator?: (options: {
    mount: string
    render?: (root: HTMLElement, ctx: DecoratorRenderCtx) => void | (() => void)
    update?: (root: HTMLElement, ctx: DecoratorRenderCtx) => void
    priority?: number
  }) => (() => void) | { destroy(): void }
}

export function parseCardActionsCharacterId(scope: string): string | null {
  if (!scope.startsWith(SCOPE_PREFIX) || !scope.endsWith(SCOPE_SUFFIX)) return null
  const id = scope.slice(SCOPE_PREFIX.length, scope.length - SCOPE_SUFFIX.length).trim()
  return id || null
}

function asCleanup(handle: unknown): () => void {
  if (typeof handle === 'function') return handle as () => void
  if (
    handle &&
    typeof handle === 'object' &&
    typeof (handle as { destroy?: unknown }).destroy === 'function'
  ) {
    return () => (handle as { destroy: () => void }).destroy()
  }
  return () => {}
}

function paintAvatar(lens: HTMLElement, url: string | null): void {
  lens.innerHTML = ''
  if (url) {
    const img = document.createElement('img')
    img.className = 'll-lens-avatar'
    img.src = url
    img.alt = 'Ari'
    lens.appendChild(img)
    return
  }
  const span = document.createElement('span')
  span.className = 'll-lens-avatar ll-lens-avatar-fallback'
  span.textContent = 'A'
  lens.appendChild(span)
}

export function startCardInjector(opts: CardInjectorOptions): () => void {
  const { ctx, ari, onOpenLens } = opts
  const lenses = new Set<HTMLButtonElement>()

  function makeLens(characterId: string): HTMLButtonElement {
    const lens = document.createElement('button')
    lens.type = 'button'
    lens.className = 'll-lens-btn ll-lens-mount'
    lens.title = "Ari's LumiLens"
    lens.setAttribute('aria-label', 'Open LumiLens with Ari')
    lens.setAttribute(LENS_MARKER, '1')
    paintAvatar(lens, ari.url)
    lenses.add(lens)
    lens.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onOpenLens({ characterId, candidateIds: [characterId] })
    })
    return lens
  }

  function attachToRoot(root: HTMLElement, scope: string): (() => void) | void {
    const characterId = parseCardActionsCharacterId(scope)
    if (!characterId) return
    root.style.display = 'contents'
    const lens = makeLens(characterId)
    root.replaceChildren(lens)
    return () => {
      lenses.delete(lens)
      lens.remove()
    }
  }

  const unsubAri = ari.subscribe((url) => {
    for (const lens of lenses) paintAvatar(lens, url)
  })

  const ui = ctx.ui as SpindleFrontendContext['ui'] & HostUiDecorators
  const decoratorHandle = ui.registerDomDecorator?.({
    mount: CARD_ACTIONS_MOUNT,
    render(root, dctx) {
      return attachToRoot(root, dctx.scope)
    },
  })

  let stopFallback: (() => void) | null = null
  if (!decoratorHandle) {
    const attached = new WeakMap<Element, HTMLButtonElement>()
    const sync = () => {
      const hosts = document.querySelectorAll(
        `[data-spindle-mount="${CARD_ACTIONS_MOUNT}"][data-spindle-scope]`,
      )
      for (const host of hosts) {
        if (attached.has(host)) continue
        const scope = host.getAttribute('data-spindle-scope') || ''
        const characterId = parseCardActionsCharacterId(scope)
        if (!characterId) continue
        const lens = makeLens(characterId)
        host.appendChild(lens)
        attached.set(host, lens)
      }
    }
    const raf: (cb: () => void) => unknown =
      typeof requestAnimationFrame === 'function'
        ? (cb) => requestAnimationFrame(cb)
        : (cb) => setTimeout(cb, 0)
    let queued = false
    let stopped = false
    const scheduleSync = () => {
      if (queued) return
      queued = true
      raf(() => {
        queued = false
        if (!stopped) sync()
      })
    }
    const mo = new MutationObserver(scheduleSync)
    mo.observe(document.documentElement, { childList: true, subtree: true })
    sync()
    stopFallback = () => {
      stopped = true
      mo.disconnect()
      for (const lens of lenses) lens.remove()
      lenses.clear()
    }
  }

  const stopDecorator = decoratorHandle ? asCleanup(decoratorHandle) : null

  return () => {
    unsubAri()
    stopDecorator?.()
    stopFallback?.()
    for (const lens of lenses) lens.remove()
    lenses.clear()
  }
}
