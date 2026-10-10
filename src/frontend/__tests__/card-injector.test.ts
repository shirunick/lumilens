import { Window } from 'happy-dom'
import { beforeEach, describe, expect, test } from 'bun:test'
import { AriStore } from '../ari-store'
import {
  CARD_ACTIONS_MOUNT,
  LENS_MARKER,
  parseCardActionsCharacterId,
  startCardInjector,
} from '../card-injector'
import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

const ID_A = '11111111-1111-4111-8111-111111111111'

function fakeCtx(ui: Record<string, unknown> = {}): SpindleFrontendContext {
  return { ui } as unknown as SpindleFrontendContext
}

describe('card-injector', () => {
  beforeEach(() => {
    const window = new Window({ url: 'https://lumiverse.local/' })
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      Node: window.Node,
      MutationObserver: window.MutationObserver,
    })
  })

  test('parses character id from card actions scope', () => {
    expect(parseCardActionsCharacterId(`character-card:${ID_A}:actions`)).toBe(ID_A)
    expect(parseCardActionsCharacterId('character-card::actions')).toBeNull()
    expect(parseCardActionsCharacterId('message:1:actions')).toBeNull()
  })

  test('registerDomDecorator renders a mount lens beside the host actions', () => {
    const opened: string[] = []
    let renderFn:
      | ((root: HTMLElement, ctx: { scope: string; node: Element; root: HTMLElement }) => void | (() => void))
      | undefined
    const ctx = fakeCtx({
      registerDomDecorator: (options: {
        mount: string
        render?: typeof renderFn
      }) => {
        expect(options.mount).toBe(CARD_ACTIONS_MOUNT)
        renderFn = options.render
        return () => {}
      },
    })
    const ari = new AriStore()
    ari.set('data:image/png;base64,xx')
    const stop = startCardInjector({
      ctx,
      ari,
      onOpenLens: (ref) => {
        if (ref.characterId) opened.push(ref.characterId)
      },
    })
    expect(renderFn).toBeDefined()
    const host = document.createElement('span')
    host.setAttribute('data-spindle-mount', CARD_ACTIONS_MOUNT)
    host.setAttribute('data-spindle-scope', `character-card:${ID_A}:actions`)
    document.body.appendChild(host)
    const root = document.createElement('div')
    host.appendChild(root)
    const dispose = renderFn!(root, { scope: `character-card:${ID_A}:actions`, node: host, root })
    const lens = root.querySelector(`[${LENS_MARKER}]`) as HTMLButtonElement
    expect(lens).toBeTruthy()
    expect(lens.classList.contains('ll-lens-mount')).toBe(true)
    expect(lens.querySelector('img')?.src).toContain('data:image/png')
    lens.click()
    expect(opened).toEqual([ID_A])
    if (typeof dispose === 'function') dispose()
    expect(root.querySelector(`[${LENS_MARKER}]`)).toBeNull()
    stop()
  })

  test('falls back to observing mount stamps when decorator api is missing', async () => {
    const opened: string[] = []
    const ari = new AriStore()
    const stop = startCardInjector({
      ctx: fakeCtx({}),
      ari,
      onOpenLens: (ref) => {
        if (ref.characterId) opened.push(ref.characterId)
      },
    })
    const host = document.createElement('span')
    host.setAttribute('data-spindle-mount', CARD_ACTIONS_MOUNT)
    host.setAttribute('data-spindle-scope', `character-card:${ID_A}:actions`)
    document.body.appendChild(host)
    await new Promise((r) => setTimeout(r, 20))
    const lens = host.querySelector(`[${LENS_MARKER}]`) as HTMLButtonElement
    expect(lens).toBeTruthy()
    lens.click()
    expect(opened).toEqual([ID_A])
    stop()
    expect(host.querySelector(`[${LENS_MARKER}]`)).toBeNull()
  })
})
