import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import type { CharacterSummary } from '../shared/types'
import { createAriAvatarEl, renderMarkdownLite } from './ari-avatar'
import type { AriStore } from './ari-store'
import { icons } from './icons'
import {
  chooserSub,
  chooserTitle,
  DEEP_LOADING,
  LOOKUP,
  QUICK_LOADING,
} from './phrases'
import type { RpcClient } from './rpc-client'
import { modalWidth, setModalWidth, showSafeModal } from './safe-modal'
import {
  art,
  button,
  errorMessage,
  h,
  loadingFrom,
  rowButton,
  tagRow,
} from './ui'

let openCount = 0

export function isQuickViewOpen(): boolean {
  return openCount > 0
}

export type QuickViewDeps = {
  ctx: SpindleFrontendContext
  rpc: RpcClient
  ari: AriStore
}

export type LensRef = {
  characterId?: string
  candidateIds?: string[]
  name?: string
}

type Mode = 'quick' | 'deep'

type QuickViewState = {
  character: CharacterSummary
  quickOverview: string | null
  deepDive: string | null
}

function titleWithName(title: string, name: string): HTMLElement {
  const h2 = h('h2', { class: 'll-qv-title' })
  const i = title.indexOf(name)
  if (i < 0) {
    h2.textContent = title
    return h2
  }
  h2.append(
    document.createTextNode(title.slice(0, i)),
    h('span', { class: 'll-qv-name-hl', text: name }),
    document.createTextNode(title.slice(i + name.length)),
  )
  return h2
}

async function loadState(
  rpc: RpcClient,
  ref: LensRef,
): Promise<QuickViewState> {
  let characterId = ref.characterId
  if (!characterId) {
    const ids = ref.candidateIds || []
    if (!ids.length && !ref.name) {
      throw new Error('I could not tell which character you meant.')
    }
    const res = await rpc.request({
      type: 'resolve_character_by_name',
      name: ref.name,
      candidateIds: ids,
    })
    if (!res.character) {
      throw new Error(
        ref.name
          ? `I could not find "${ref.name}" in your library.`
          : 'I could not find that card in your library.',
      )
    }
    characterId = res.character.id
  }
  const res = await rpc.request({ type: 'get_quick_view', characterId })
  return {
    character: res.character,
    quickOverview: res.quickOverview,
    deepDive: res.deepDive,
  }
}

export async function openQuickView(
  deps: QuickViewDeps,
  ref: LensRef | string,
): Promise<void> {
  const { ctx, rpc, ari } = deps
  const lensRef: LensRef = typeof ref === 'string' ? { characterId: ref } : ref

  const modal = showSafeModal(ctx, {
    title: 'LumiLens',
    width: modalWidth('narrow'),
    maxHeight: Math.max(480, window.innerHeight - 48),
    fullscreenOnMobile: true,
  })
  openCount += 1
  let loadingTimer: ReturnType<typeof setTimeout> | null = null
  modal.onDismiss(() => {
    if (loadingTimer) clearTimeout(loadingTimer)
    loadingTimer = null
    openCount = Math.max(0, openCount - 1)
  })

  const shell = h('div', { class: 'll-qv' })
  modal.root.replaceChildren(shell)

  const resize = (size: 'narrow' | 'wide') =>
    setModalWidth(modal, modalWidth(size))

  let state: QuickViewState | null = null

  function header(): HTMLElement {
    if (!state) {
      return h('div', { class: 'll-qv-head' }, [
        createAriAvatarEl(ari.url, 'll-avatar'),
        h('div', { class: 'll-qv-meta' }, [
          h('div', { class: 'll-qv-name', text: 'Ari' }),
          h('div', { class: 'll-muted', text: 'Character decoder' }),
        ]),
      ])
    }
    const c = state.character
    return h('div', { class: 'll-qv-head' }, [
      art(c, 'll-qv-art'),
      h('div', { class: 'll-qv-meta' }, [
        h('div', { class: 'll-qv-name', text: c.name }),
        tagRow(c.tags, 6),
      ]),
    ])
  }

  function render(...content: HTMLElement[]): void {
    shell.replaceChildren(header(), ...content)
  }

  function renderError(message: string, retry?: () => void): void {
    resize('narrow')
    const row = h('div', { class: 'll-btn-row' }, [
      button('Back', { onClick: () => renderChooser() }),
    ])
    if (retry) {
      row.append(
        button('Retry', {
          kind: 'primary',
          icon: icons.refresh(16),
          onClick: retry,
        }),
      )
    }
    render(h('div', { class: 'll-error', text: message }), row)
  }

  function choice(
    mode: Mode,
    icon: string,
    title: string,
    desc: string,
  ): HTMLElement {
    return rowButton({
      variant: 'choice',
      icon,
      title,
      desc,
      onClick: () => void run(mode),
    })
  }

  function renderChooser(): void {
    if (!state) return
    resize('narrow')
    render(
      h('div', { class: 'll-qv-ask' }, [
        titleWithName(chooserTitle(state.character.name), state.character.name),
        h('p', { class: 'll-qv-sub', text: chooserSub() }),
      ]),
      h('div', { class: 'll-choices' }, [
        choice(
          'quick',
          icons.bolt(22),
          'The Quick Pitch',
          'What this card is and who you are in it. I keep it short.',
        ),
        choice(
          'deep',
          icons.book(22),
          'The Deep Dive',
          'Personality, hooks, RP potential, and the traps. I take my time with this one.',
        ),
      ]),
    )
  }

  function renderResult(mode: Mode): void {
    if (!state) return
    const text = mode === 'quick' ? state.quickOverview : state.deepDive
    if (!text) return
    resize('wide')

    const seg = h('div', { class: 'll-seg' }, [
      h('button', {
        type: 'button',
        class: 'll-seg-btn',
        text: 'Quick Pitch',
        'data-active': mode === 'quick' ? 'true' : 'false',
        onclick: () => void run('quick'),
      }),
      h('button', {
        type: 'button',
        class: 'll-seg-btn',
        text: 'Deep Dive',
        'data-active': mode === 'deep' ? 'true' : 'false',
        onclick: () => void run('deep'),
      }),
    ])

    const body = h('div', {
      class: mode === 'deep' ? 'll-ari-text ll-md' : 'll-ari-text',
    })
    if (mode === 'deep') body.innerHTML = renderMarkdownLite(text)
    else body.textContent = text

    render(
      seg,
      h('div', { class: 'll-ari-block' }, [
        createAriAvatarEl(ari.url, 'll-avatar'),
        body,
      ]),
      h('div', { class: 'll-btn-row' }, [
        button('Regenerate', {
          icon: icons.refresh(16),
          onClick: () => void run(mode, true),
        }),
        button('Change angle', {
          kind: 'ghost',
          onClick: () => renderChooser(),
        }),
      ]),
    )
  }

  async function run(mode: Mode, force = false): Promise<void> {
    if (!state) return
    const cached = mode === 'quick' ? state.quickOverview : state.deepDive
    if (cached && !force) {
      renderResult(mode)
      return
    }
    resize('narrow')
    render(loadingFrom(ari, mode === 'quick' ? QUICK_LOADING : DEEP_LOADING))
    try {
      const r = await rpc.request({
        type:
          mode === 'quick' ? 'generate_quick_overview' : 'generate_deep_dive',
        characterId: state.character.id,
        force,
      })
      if (mode === 'quick') state.quickOverview = r.text
      else state.deepDive = r.text
      renderResult(mode)
    } catch (e) {
      renderError(
        errorMessage(e, 'I could not write that. Try again.'),
        () => void run(mode, true),
      )
    }
  }

  render()
  loadingTimer = setTimeout(() => {
    loadingTimer = null
    render(loadingFrom(ari, LOOKUP))
  }, 180)
  try {
    state = await loadState(rpc, lensRef)
    if (loadingTimer) clearTimeout(loadingTimer)
    loadingTimer = null
    renderChooser()
  } catch (e) {
    if (loadingTimer) clearTimeout(loadingTimer)
    loadingTimer = null
    shell.replaceChildren(
      header(),
      h('div', {
        class: 'll-error',
        text: errorMessage(e, 'I could not find that card.'),
      }),
    )
  }
}
