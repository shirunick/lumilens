import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { DRAWER_TAB_ID, VERSION } from '../shared/constants'
import { createAriAvatarEl } from './ari-avatar'
import type { AriStore } from './ari-store'
import type { ChatOpener } from './chat-opener'
import { mountConnectionPicker } from './connection-picker'
import { icons, MAGNIFYING_GLASS_SVG } from './icons'
import { mountRandomPicker } from './random-picker'
import type { RpcClient } from './rpc-client'
import type { TinderMode } from '../shared/types'
import { modalWidth, showSafeModal } from './safe-modal'
import { mountTinderStack } from './tinder-stack'
import { h, iconButton, rowButton } from './ui'

type PageId = 'home' | 'picker' | 'tinder' | 'settings'

type Page = {
  el: HTMLElement
  mounted: boolean
  mount: (body: HTMLElement) => void
  onShow?: () => void
  destroy?: () => void
  body: HTMLElement
}

export function registerAriDrawerTab(opts: {
  ctx: SpindleFrontendContext
  rpc: RpcClient
  chatOpener: ChatOpener
  ari: AriStore
}): { destroy: () => void } {
  const { ctx, rpc, chatOpener, ari } = opts

  const tab = ctx.ui.registerDrawerTab({
    id: DRAWER_TAB_ID,
    title: "Ari's LumiLens",
    shortName: 'Ari',
    headerTitle: 'LumiLens',
    description: 'Ari reads your character cards so you do not have to',
    keywords: ['ari', 'lumilens', 'tinder', 'picker', 'character', 'lens', 'swipe'],
    iconSvg: MAGNIFYING_GLASS_SVG,
  })

  const root = h('div', { class: 'll-root' })
  tab.root.appendChild(root)

  const pages = new Map<PageId, Page>()

  function show(id: PageId): void {
    for (const [key, page] of pages) page.el.hidden = key !== id
    root.scrollTop = 0
    const page = pages.get(id)
    if (!page) return
    if (!page.mounted) {
      page.mounted = true
      page.mount(page.body)
    }
    page.onShow?.()
  }

  function subPage(
    id: Exclude<PageId, 'home'>,
    title: string,
    mount: (body: HTMLElement) => Pick<Page, 'onShow' | 'destroy'>,
    opts: { description?: string } = {},
  ): void {
    const body = h('div', { class: 'll-page-body' })
    const el = h('section', { class: 'll-page', hidden: true }, [
      h('div', { class: 'll-topbar' }, [
        iconButton(icons.chevronLeft(), 'Back', () => show('home')),
        h('div', { class: 'll-topbar-title', text: title }),
      ]),
      ...(opts.description
        ? [h('div', { class: 'll-page-lead', text: opts.description })]
        : []),
      body,
    ])
    const page: Page = {
      el,
      body,
      mounted: false,
      mount: (b) => {
        const api = mount(b)
        page.onShow = api.onShow
        page.destroy = api.destroy
      },
    }
    pages.set(id, page)
    root.appendChild(el)
  }

  let avatarEl = createAriAvatarEl(ari.url, 'll-avatar')
  const avatarWrap = h('div', { class: 'll-hero-avatar' }, [avatarEl])
  const unsubAri = ari.subscribe((url) => {
    const next = createAriAvatarEl(url, 'll-avatar')
    avatarEl.replaceWith(next)
    avatarEl = next
  })

  function menuItem(
    id: Exclude<PageId, 'home'>,
    icon: string,
    title: string,
    desc: string,
  ): HTMLElement {
    return rowButton({
      variant: 'menu',
      icon,
      title,
      desc,
      chevron: true,
      onClick: () => show(id),
    })
  }

  const home = h('section', { class: 'll-page' }, [
    h('div', { class: 'll-hero' }, [
      avatarWrap,
      h('div', { class: 'll-hero-name', text: 'Ari' }),
      h('div', {
        class: 'll-hero-sub',
        text: 'I have read every card in your library. Ask me about any of them.',
      }),
    ]),
    h('div', { class: 'll-menu' }, [
      menuItem(
        'picker',
        icons.dice(22),
        'Card Picker',
        'I pull a card for you. At random, or by vibe.',
      ),
      menuItem(
        'tinder',
        icons.flame(22),
        'Tinder',
        'One card at a time. Purge the duds or pick your next chat.',
      ),
      menuItem(
        'settings',
        icons.sliders(22),
        'Settings',
        'Which model I think with, what I remember, and testing tools.',
      ),
    ]),
    h('div', { class: 'll-foot', text: `v${VERSION}` }),
  ])
  pages.set('home', {
    el: home,
    body: home,
    mounted: true,
    mount: () => {},
  })
  root.appendChild(home)

  subPage('picker', 'Card Picker', (body) => {
    const picker = mountRandomPicker({ ctx, rpc, chatOpener, ari, root: body })
    return { destroy: picker.destroy }
  })

  let activeTinder: { destroy: () => void } | null = null

  function launchTinder(mode: TinderMode): void {
    if (activeTinder) return
    const modal = showSafeModal(ctx, {
      title: 'Tinder',
      width: modalWidth('narrow'),
      maxHeight: Math.max(640, window.innerHeight - 24),
      fullscreenOnMobile: true,
    })
    const host = h('div', { class: 'll-tinder-modal' })
    const bodyEl = modal.root.parentElement
    if (bodyEl) {
      Object.assign(bodyEl.style, {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overscrollBehavior: 'none',
      })
    }
    Object.assign(modal.root.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
    })
    modal.root.replaceChildren(host)
    const tinder = mountTinderStack({ ctx, rpc, chatOpener, ari, root: host })
    activeTinder = tinder
    modal.onDismiss(() => {
      tinder.destroy()
      if (activeTinder === tinder) activeTinder = null
    })
    const shuffleBtn = iconButton(icons.shuffle(18), 'Reshuffle', () =>
      tinder.reshuffle(),
    )
    shuffleBtn.classList.add('ll-header-btn')
    const container = modal.root.parentElement?.parentElement
    const closeBtn = container?.querySelector('button')
    if (closeBtn?.parentElement) {
      closeBtn.parentElement.insertBefore(shuffleBtn, closeBtn)
    } else {
      host.prepend(shuffleBtn)
    }
    const scroller = modal.root.parentElement
    if (scroller) scroller.scrollTop = 0
    tinder.start(mode)
  }

  subPage('tinder', 'Tinder', (body) => {
    body.append(
      h('div', { class: 'll-launch' }, [
        h('p', {
          class: 'll-launch-text',
          text: 'I show you one card at a time with my honest take. You decide what happens to it.',
        }),
        rowButton({
          variant: 'menu',
          icon: icons.trash(22),
          title: 'Purge Mode',
          desc: 'Keep what earns its place. Delete the rest.',
          onClick: () => launchTinder('out'),
        }),
        rowButton({
          variant: 'menu',
          icon: icons.chat(22),
          title: 'Chat Mode',
          desc: 'Pass, or pick who you talk to next.',
          onClick: () => launchTinder('chat'),
        }),
      ]),
    )
    return { destroy: () => activeTinder?.destroy() }
  })

  subPage(
    'settings',
    'Settings',
    (body) => {
      const settings = mountConnectionPicker(body, rpc, ctx)
      return {
        onShow: () => void settings.refresh().catch(() => {}),
        destroy: () => settings.destroy(),
      }
    },
    {
      description:
        'Pick the model I think with, clear what I remember, and flip the testing switches.',
    },
  )

  show('home')

  return {
    destroy: () => {
      unsubAri()
      for (const page of pages.values()) page.destroy?.()
      tab.destroy()
    },
  }
}
