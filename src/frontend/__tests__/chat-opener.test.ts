import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createChatOpener } from '../chat-opener'

describe('chat-opener', () => {
  let windowRef: Window
  let fetchCalls: Array<{ url: string; init?: RequestInit }>
  let pushStateCalls: string[]
  let popstateCount: number

  beforeEach(() => {
    windowRef = new Window({ url: 'https://lumiverse.local/' })
    const { document, window, history } = windowRef
    Object.assign(globalThis, {
      window,
      document,
      history,
      HTMLElement: window.HTMLElement,
      HTMLButtonElement: window.HTMLButtonElement,
      Element: window.Element,
      Node: window.Node,
      PopStateEvent: window.PopStateEvent,
      Response: globalThis.Response,
    })

    fetchCalls = []
    pushStateCalls = []
    popstateCount = 0

    const originalPush = history.pushState.bind(history)
    history.pushState = ((
      state: unknown,
      title: string,
      url?: string | URL | null,
    ) => {
      pushStateCalls.push(String(url))
      return originalPush(state, title, url as string)
    }) as typeof history.pushState

    window.addEventListener('popstate', () => {
      popstateCount++
    })

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const u = String(url)
      fetchCalls.push({ url: u, init })
      if (u.includes('/character-chats/')) {
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (u.includes('/api/v1/chats') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'chat-new' }), {
          status: 200,
        })
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch
  })

  afterEach(() => {
    windowRef.close()
  })

  function mockCtx(overrides: Record<string, unknown> = {}) {
    const modals: Array<{ root: HTMLElement; dismiss: () => void }> = []
    return {
      characters: {
        get: async (id: string) => ({
          id,
          name: 'Test Char',
          first_mes: 'Hello',
          alternate_greetings: [] as string[],
        }),
      },
      ui: {
        showModal: (opts: { title: string }) => {
          const root = document.createElement('div')
          const modal = {
            root,
            dismiss: () => {
              modal.dismissed = true
            },
            dismissed: false,
            title: opts.title,
          }
          modals.push(modal)
          return modal
        },
      },
      __modals: modals,
      ...overrides,
    }
  }

  test('0 chats creates and navigates', async () => {
    const opener = createChatOpener({ ctx: mockCtx() as never })
    await opener.openOrCreateLumiverseChat('CHAR-1')
    expect(fetchCalls.some((c) => c.url.includes('character-chats'))).toBe(
      true,
    )
    expect(
      fetchCalls.some(
        (c) => c.url.includes('/api/v1/chats') && c.init?.method === 'POST',
      ),
    ).toBe(true)
    expect(pushStateCalls.some((u) => u.includes('/chat/chat-new'))).toBe(true)
    expect(popstateCount).toBeGreaterThan(0)
  })

  test('1 chat navigates without create', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url)
      fetchCalls.push({ url: u })
      if (u.includes('/character-chats/')) {
        return new Response(JSON.stringify([{ id: 'existing-chat' }]), {
          status: 200,
        })
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const opener = createChatOpener({ ctx: mockCtx() as never })
    await opener.openOrCreateLumiverseChat('c1')
    expect(
      fetchCalls.some(
        (c) => c.url.includes('/api/v1/chats') && c.init?.method === 'POST',
      ),
    ).toBe(false)
    expect(pushStateCalls.some((u) => u.includes('/chat/existing-chat'))).toBe(
      true,
    )
  })

  test('2+ chats opens picker modal', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/character-chats/')) {
        return new Response(
          JSON.stringify([
            { id: 'a', name: 'One', updated_at: 2 },
            { id: 'b', name: 'Two', updated_at: 1 },
          ]),
          { status: 200 },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const ctx = mockCtx()
    const opener = createChatOpener({ ctx: ctx as never })
    await opener.openOrCreateLumiverseChat('c1')
    expect(ctx.__modals.length).toBe(1)
    expect(ctx.__modals[0].root.innerHTML).toContain('New chat')
  })

  test('create includes greeting_index when provided', async () => {
    const opener = createChatOpener({ ctx: mockCtx() as never })
    let body: unknown
    globalThis.fetch = (async (_url, init) => {
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body))
        return new Response(JSON.stringify({ id: 'g1' }), { status: 200 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }) as typeof fetch
    await opener.createLumiverseChat('cid', 2)
    expect(body).toEqual({ character_id: 'cid', greeting_index: 2 })
  })

  test('single-flight blocks concurrent opens', async () => {
    let release!: (v: Response) => void
    const gate = new Promise<Response>((r) => {
      release = r
    })
    let n = 0
    globalThis.fetch = (async (url, init) => {
      n++
      if (n === 1) return gate
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'x' }), { status: 200 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }) as typeof fetch

    const opener = createChatOpener({ ctx: mockCtx() as never })
    const p1 = opener.openOrCreateLumiverseChat('c1')
    await Promise.resolve()
    expect(opener._isBusy()).toBe(true)
    await opener.openOrCreateLumiverseChat('c1')
    release(new Response(JSON.stringify([]), { status: 200 }))
    await p1
    expect(opener._isBusy()).toBe(false)
  })
})
