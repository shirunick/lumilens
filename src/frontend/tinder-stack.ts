import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import {
  SWIPE_THRESHOLD_PX,
  SWIPE_THRESHOLD_RATIO,
} from '../shared/constants'
import type { TinderCardView, TinderMode } from '../shared/types'
import { createAriAvatarEl } from './ari-avatar'
import type { AriStore } from './ari-store'
import type { ChatOpener } from './chat-opener'
import { icons } from './icons'
import { pick, TINDER_EMPTY, TINDER_LOADING } from './phrases'
import { isQuickViewOpen, openQuickView } from './quick-view'
import type { RpcClient } from './rpc-client'
import {
  art,
  button,
  errorMessage,
  h,
  iconButton,
  loadingFrom,
  tagRow,
} from './ui'

export type TinderDeps = {
  ctx: SpindleFrontendContext
  rpc: RpcClient
  chatOpener: ChatOpener
  ari: AriStore
  root: HTMLElement
}

type Direction = 'left' | 'right'

const DRAG_ROTATE_DIVISOR = 18
const FLY_OUT_ROTATE_DEG = 22
const FLY_OUT_MS = 280
const FALLBACK_CARD_WIDTH = 300

type DeckCard = TinderCardView & {
  generating?: boolean
  error?: string | null
}

const LABELS: Record<TinderMode, { left: string; right: string }> = {
  out: { left: 'Delete', right: 'Keep' },
  chat: { left: 'Pass', right: 'Chat' },
}

export function mountTinderStack(deps: TinderDeps): {
  destroy: () => void
  start: (mode: TinderMode) => void
  reshuffle: () => void
} {
  const { root, rpc, ctx, chatOpener, ari } = deps
  let mode: TinderMode = 'out'
  let card: DeckCard | null = null
  let cardEl: HTMLElement | null = null
  let bioEl: HTMLElement | null = null
  let flyTimer: ReturnType<typeof setTimeout> | null = null
  let stampLeft: HTMLElement | null = null
  let stampRight: HTMLElement | null = null
  let busy = false
  let bioToken = 0
  let drag: { startX: number; pointerId: number } | null = null

  function bioDots(): HTMLElement {
    return h('div', { class: 'll-bio-dots', 'aria-label': 'Writing' }, [
      h('span'),
      h('span'),
      h('span'),
    ])
  }

  function needsBio(view: DeckCard): boolean {
    return !view.tinderDesc && !view.error
  }

  root.classList.add('ll-tinder')

  const progressText = h('div', { class: 'll-progress-text' })
  const progressBar = h('span')
  const progress = h('div', { class: 'll-progress' }, [
    progressText,
    h('div', { class: 'll-bar' }, [progressBar]),
  ])

  const deck = h('div', { class: 'll-deck' })
  const status = h('div', { class: 'll-status' })

  const nopeBtn = h('button', {
    type: 'button',
    class: 'll-round ll-round-nope',
    onclick: () => void doSwipe('left'),
  })
  const likeBtn = h('button', {
    type: 'button',
    class: 'll-round ll-round-like',
    onclick: () => void doSwipe('right'),
  })
  const undoBtn = h('button', {
    type: 'button',
    class: 'll-round ll-round-sm ll-round-undo',
    title: 'Undo',
    'aria-label': 'Undo',
    html: icons.undo(20),
    onclick: () => void undo(),
  })
  function askAri(): void {
    if (!card) return
    void openQuickView({ ctx, rpc, ari }, { characterId: card.character.id })
  }

  const infoBtn = h('button', {
    type: 'button',
    class: 'll-round ll-round-sm ll-round-info',
    title: 'Ask Ari',
    'aria-label': 'Ask Ari',
    html: icons.search(20),
    onclick: () => askAri(),
  })
  const hint = h('div', { class: 'll-hint' })

  root.replaceChildren(

    progress,
    deck,
    h('div', { class: 'll-tactions' }, [undoBtn, nopeBtn, infoBtn, likeBtn]),
    hint,
    status,
  )

  function setModeUi(): void {
    nopeBtn.innerHTML = mode === 'out' ? icons.trash(26) : icons.x(26)
    likeBtn.innerHTML = mode === 'out' ? icons.check(26) : icons.heart(26)
    nopeBtn.title = LABELS[mode].left
    likeBtn.title = LABELS[mode].right
    nopeBtn.setAttribute('aria-label', LABELS[mode].left)
    likeBtn.setAttribute('aria-label', LABELS[mode].right)
    hint.textContent = `↑ Ask Ari  ·  ← ${LABELS[mode].left}  ·  ${LABELS[mode].right} →  ·  ↓ Undo`
  }

  function setActionsEnabled(): void {
    const on = !!card && !busy
    nopeBtn.disabled = !on
    likeBtn.disabled = !on
    infoBtn.disabled = !card
    undoBtn.disabled = busy
  }

  function renderProgress(): void {
    if (!card) {
      progressText.replaceChildren()
      progressBar.style.width = '0%'
      return
    }
    const p = card.progress
    const counters =
      mode === 'out'
        ? `${p.kept} kept · ${p.deleted} deleted`
        : `${p.accepted} chatted · ${p.declined} passed`
    progressText.replaceChildren(
      h('span', { text: `Card ${p.current} of ${p.total}` }),
      h('span', { text: counters }),
    )
    const pct = p.total > 0 ? ((p.current - 1) / p.total) * 100 : 0
    progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`
  }

  function setStamps(dx: number, threshold: number): void {
    const strength = Math.min(1, Math.abs(dx) / threshold)
    if (stampRight) stampRight.style.opacity = dx > 0 ? String(strength) : '0'
    if (stampLeft) stampLeft.style.opacity = dx < 0 ? String(strength) : '0'
  }

  function thresholdFor(el: HTMLElement): number {
    const width = el.getBoundingClientRect().width || FALLBACK_CARD_WIDTH
    return Math.max(SWIPE_THRESHOLD_PX, width * SWIPE_THRESHOLD_RATIO)
  }

  async function fillBio(target: DeckCard, force = false): Promise<void> {
    const token = ++bioToken
    target.generating = true
    try {
      const r = await rpc.request({
        type: 'generate_tinder_desc',
        characterId: target.character.id,
        force,
      })
      if (token !== bioToken || card !== target) return
      target.tinderDesc = r.text
      target.error = null
      target.generating = false
      renderBio()
    } catch (err) {
      if (token !== bioToken || card !== target) return
      target.error = errorMessage(err, 'I could not write that bio.')
      target.generating = false
      renderBio()
    }
  }

  async function retryBio(): Promise<void> {
    const target = card
    if (!target || target.generating) return
    target.tinderDesc = null
    target.error = null
    target.generating = true
    renderBio()
    await fillBio(target, true)
  }

  function bindDrag(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => {
      if (busy) return
      if ((e.target as HTMLElement).closest('button')) return
      drag = { startX: e.clientX, pointerId: e.pointerId }
      el.setPointerCapture(e.pointerId)
      el.style.transition = 'none'
    })
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      const dx = e.clientX - drag.startX
      el.style.transform = `translateX(${dx}px) rotate(${dx / DRAG_ROTATE_DIVISOR}deg)`
      setStamps(dx, thresholdFor(el))
    })
    el.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      const dx = e.clientX - drag.startX
      drag = null
      el.style.transition = ''
      if (Math.abs(dx) >= thresholdFor(el)) {
        void doSwipe(dx > 0 ? 'right' : 'left')
      } else {
        snapBack()
      }
    })
    el.addEventListener('pointercancel', () => {
      drag = null
      snapBack()
    })
  }

  function renderBio(): void {
    if (!card || !bioEl) return
    const waiting = needsBio(card) || !!card.generating
    const bioText = waiting
      ? h('div', { class: 'll-tcard-bio-text' }, [bioDots()])
      : h('div', {
          class: 'll-tcard-bio-text',
          text: card.tinderDesc || card.error || '',
        })
    bioEl.replaceChildren(
      createAriAvatarEl(ari.url, 'll-avatar ll-avatar-sm'),
      bioText,
    )
    if (!waiting) {
      bioEl.append(
        iconButton(icons.refresh(16), 'Regenerate', () => {
          void retryBio()
        }, 'll-icon-btn ll-bio-regen'),
      )
    }
  }

  function renderCard(): void {
    deck.replaceChildren()
    cardEl = null
    bioEl = null
    stampLeft = null
    stampRight = null
    setActionsEnabled()
    renderProgress()

    if (!card) {
      deck.append(
        h('div', { class: 'll-empty' }, [
          h('div', { text: pick(TINDER_EMPTY) }),
          h('div', { style: 'margin-top:14px' }, [
            button('Reshuffle', {
              kind: 'primary',
              icon: icons.shuffle(16),
              onClick: () => void reshuffle(),
            }),
          ]),
        ]),
      )
      return
    }

    const c = card.character
    const bio = h('div', { class: 'll-tcard-bio' })
    bioEl = bio
    renderBio()

    stampLeft = h('div', {
      class: 'll-stamp ll-stamp-left',
      text: LABELS[mode].left,
    })
    stampRight = h('div', {
      class: 'll-stamp ll-stamp-right',
      text: LABELS[mode].right,
    })

    const el = h('div', { class: 'll-tcard', tabindex: '0' }, [
      art(c, 'll-tcard-img'),
      h('div', { class: 'll-tcard-fade' }),
      stampRight,
      stampLeft,
      h('div', { class: 'll-tcard-info' }, [
        h('div', { class: 'll-tcard-name', text: c.name }),
        tagRow(c.tags, 4),
        bio,
      ]),
    ])
    bindDrag(el)
    deck.append(
      h('div', { class: 'll-ghost ll-ghost-2' }),
      h('div', { class: 'll-ghost ll-ghost-1' }),
      el,
    )
    cardEl = el
    queueMicrotask(() => {
      if (cardEl === el) el.focus({ preventScroll: true })
    })
  }

  function snapBack(): void {
    if (!cardEl) return
    cardEl.style.transition = 'transform 0.25s ease'
    cardEl.style.transform = ''
    if (stampLeft) stampLeft.style.opacity = '0'
    if (stampRight) stampRight.style.opacity = '0'
  }

  function flyOut(direction: Direction): Promise<void> {
    const el = cardEl
    if (!el) return Promise.resolve()
    const w = window.innerWidth
    const sign = direction === 'right' ? 1 : -1
    if (direction === 'right') {
      if (stampRight) stampRight.style.opacity = '1'
      if (stampLeft) stampLeft.style.opacity = '0'
    } else {
      if (stampLeft) stampLeft.style.opacity = '1'
      if (stampRight) stampRight.style.opacity = '0'
    }
    el.style.transition = `transform ${FLY_OUT_MS}ms ease-out, opacity ${FLY_OUT_MS}ms ease-out`
    el.style.transform = `translateX(${sign * w}px) rotate(${sign * FLY_OUT_ROTATE_DEG}deg)`
    el.style.opacity = '0'
    return new Promise((resolve) => {
      flyTimer = setTimeout(() => {
        flyTimer = null
        resolve()
      }, FLY_OUT_MS)
    })
  }

  function applyCard(next: TinderCardView | null, empty: boolean): void {
    bioToken += 1
    card = empty || !next ? null : next
    renderCard()
    if (card && needsBio(card)) {
      void fillBio(card)
    }
  }

  async function init(m: TinderMode): Promise<void> {
    mode = m
    setModeUi()
    busy = true
    setActionsEnabled()
    deck.replaceChildren(loadingFrom(ari, TINDER_LOADING))
    status.textContent = ''
    try {
      const r = await rpc.request({ type: 'tinder_init', mode: m })
      busy = false
      applyCard(r.card, r.empty)
      status.textContent = r.empty ? 'Your library is empty. Nothing for me to show you.' : ''
    } catch (e) {
      busy = false
      applyCard(null, true)
      status.textContent = errorMessage(e, 'Something broke. Try again.')
    }
  }

  async function doSwipe(direction: Direction): Promise<void> {
    if (busy || !card) return
    busy = true
    setActionsEnabled()
    try {
      const name = card.character.name
      const characterId = card.character.id

      if (mode === 'out' && direction === 'left') {
        const { confirmed } = await ctx.ui.showConfirm({
          title: `Delete ${name}?`,
          message:
            'I will delete this card from Lumiverse. There is no coming back from it.',
          variant: 'danger',
          confirmLabel: 'Delete',
        })
        if (!confirmed) {
          snapBack()
          return
        }
      }

      if (mode === 'chat' && direction === 'right') {
        const { confirmed } = await ctx.ui.showConfirm({
          title: `Start a chat with ${name}?`,
          message: `I will open a chat with ${name}. Good luck.`,
          variant: 'success',
          confirmLabel: 'Start chat',
        })
        if (!confirmed) {
          snapBack()
          return
        }
        await chatOpener.openOrCreateLumiverseChat(characterId)
      }

      const flying = flyOut(direction)
      const r = await rpc.request({ type: 'tinder_swipe', direction })
      await flying
      busy = false
      applyCard(r.card, r.empty)
      status.textContent =
        r.action === 'delete_mock'
          ? 'Testing mode. I only pretended to delete that one.'
          : ''
    } catch (e) {
      status.textContent = errorMessage(e, 'That swipe did not go through.')
      snapBack()
    } finally {
      busy = false
      setActionsEnabled()
    }
  }

  async function undo(): Promise<void> {
    if (busy) return
    busy = true
    setActionsEnabled()
    try {
      const r = await rpc.request({ type: 'tinder_undo' })
      busy = false
      applyCard(r.card, r.empty)
      status.textContent = ''
    } catch (e) {
      status.textContent = errorMessage(e, 'I could not undo that.')
    } finally {
      busy = false
      setActionsEnabled()
    }
  }

  async function reshuffle(): Promise<void> {
    if (busy) return
    busy = true
    setActionsEnabled()
    try {
      const r = await rpc.request({ type: 'tinder_reshuffle' })
      busy = false
      applyCard(r.card, r.empty)
      status.textContent = ''
    } catch (e) {
      status.textContent = errorMessage(e, 'I could not reshuffle the deck.')
    } finally {
      busy = false
      setActionsEnabled()
    }
  }

  const onKey = (e: KeyboardEvent): void => {
    if (busy || root.getClientRects().length === 0) return
    if (isQuickViewOpen()) return
    const t = e.target as HTMLElement | null
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    if (t?.isContentEditable) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      void doSwipe('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      void doSwipe('right')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      askAri()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      void undo()
    }
  }
  window.addEventListener('keydown', onKey, true)

  setModeUi()
  setActionsEnabled()
  renderProgress()

  return {
    destroy: () => {
      if (flyTimer) clearTimeout(flyTimer)
      flyTimer = null
      bioToken += 1
      window.removeEventListener('keydown', onKey, true)
      root.replaceChildren()
    },
    start: (m: TinderMode) => {
      void init(m)
    },
    reshuffle: () => {
      if (!busy) void reshuffle()
    },
  }
}
