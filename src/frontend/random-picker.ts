import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { CATEGORY_TAGS } from '../shared/constants'
import type { CharacterSummary } from '../shared/types'
import { createAriAvatarEl } from './ari-avatar'
import type { AriStore } from './ari-store'
import type { ChatOpener } from './chat-opener'
import { icons } from './icons'
import {
  EMPTY_LIBRARY,
  foundIntro,
  NO_MATCHES,
  NO_MORE,
  PITCH_WAITING,
  pick,
  SEARCH_LOADING,
  SURPRISE_LOADING,
  surpriseIntro,
} from './phrases'
import { openQuickView } from './quick-view'
import type { RpcClient } from './rpc-client'
import {
  art,
  button,
  chip,
  errorMessage,
  h,
  iconButton,
  loadingFrom,
  tagRow,
} from './ui'

export type RandomPickerDeps = {
  ctx: SpindleFrontendContext
  rpc: RpcClient
  chatOpener: ChatOpener
  ari: AriStore
  root: HTMLElement
}

type Kind = 'surprise' | 'find'

type PitchSlot = {
  char: CharacterSummary
  text: HTMLElement
}

export function mountRandomPicker(deps: RandomPickerDeps): {
  destroy: () => void
} {
  const { root, rpc, ctx, chatOpener, ari } = deps
  const selectedTags = new Set<string>()
  let shownIds: string[] = []
  let kind: Kind = 'find'
  let busy = false
  let runToken = 0

  const surpriseBtn = h(
    'button',
    { type: 'button', class: 'll-hero-btn', onclick: () => void startSurprise() },
    [
      h('span', { class: 'll-hero-btn-icon', html: icons.dice(24) }),
      h('span', {}, [
        h('div', { class: 'll-hero-btn-title', text: 'Surprise me' }),
        h('div', {
          class: 'll-hero-btn-desc',
          text: 'I close my eyes and point at your library.',
        }),
      ]),
    ],
  )

  const nlInput = h('textarea', {
    class: 'll-textarea',
    placeholder: 'e.g. a brooding vampire with a redemption arc',
    rows: 3,
  })

  const findBtn = button('Find cards', {
    kind: 'primary',
    icon: icons.search(16),
    onClick: () => void startFind(false),
  })
  findBtn.classList.add('ll-btn-block')

  const formView = h('div', { class: 'll-page-body' }, [
    surpriseBtn,
    h('div', { class: 'll-divider', text: 'or search by vibe' }),
    h('div', { class: 'll-form' }, [
      h('div', {}, [
        h('div', { class: 'll-field-label', text: 'Categories' }),
        h(
          'div',
          { class: 'll-chips' },
          CATEGORY_TAGS.map((t) =>
            chip(t, false, (next) => {
              if (next) selectedTags.add(t)
              else selectedTags.delete(t)
            }),
          ),
        ),
      ]),
      h('div', {}, [
        h('div', { class: 'll-field-label', text: 'Tell me what you are after' }),
        nlInput,
      ]),
      findBtn,
    ]),
  ])

  const resultsBody = h('div', { class: 'll-results' })
  const resultsView = h('div', { class: 'll-page-body' }, [
    h('div', { class: 'll-results-bar' }, [
      iconButton(icons.chevronLeft(), 'New search', () => showForm()),
      h('span', { class: 'll-results-bar-text', text: 'New search' }),
    ]),
    resultsBody,
  ])
  resultsView.hidden = true

  root.replaceChildren(formView, resultsView)

  function showForm(): void {
    runToken++
    busy = false
    formView.hidden = false
    resultsView.hidden = true
    root.parentElement?.classList.remove('ll-page-results')
  }

  function showResults(): void {
    formView.hidden = true
    resultsView.hidden = false
    root.parentElement?.classList.add('ll-page-results')
  }

  function showMessage(lines: readonly string[] | string, isError = false): void {
    const text = typeof lines === 'string' ? lines : pick(lines)
    resultsBody.replaceChildren(
      h('div', { class: isError ? 'll-error' : 'll-empty', text }),
    )
  }

  function differentButton(label: string): HTMLElement {
    const b = button(label, {
      kind: 'primary',
      icon: icons.shuffle(16),
      onClick: () => void (kind === 'surprise' ? startSurprise() : startFind(true)),
    })
    b.classList.add('ll-btn-block')
    return b
  }

  function intro(text: string): HTMLElement {
    return h('div', { class: 'll-intro' }, [
      createAriAvatarEl(ari.url, 'll-avatar ll-avatar-sm'),
      h('div', { class: 'll-intro-text', text }),
    ])
  }

  function buildCard(char: CharacterSummary): { el: HTMLElement; slot: PitchSlot } {
    const pitchText = h('div', {
      class: 'll-pitch-text ll-pitch-wait',
      text: pick(PITCH_WAITING),
    })
    const el = h('article', { class: 'll-rcard' }, [
      h('div', { class: 'll-rcard-top' }, [
        art(char, 'll-rcard-art'),
        h('div', { class: 'll-rcard-body' }, [
          h('div', { class: 'll-rcard-name', text: char.name }),
          tagRow(char.tags, 5),
        ]),
      ]),
      h('div', { class: 'll-pitch' }, [
        createAriAvatarEl(ari.url, 'll-avatar ll-avatar-sm'),
        pitchText,
      ]),
      h('div', { class: 'll-btn-row' }, [
        button('Full read', {
          icon: icons.search(16),
          onClick: () =>
            void openQuickView({ ctx, rpc, ari }, { characterId: char.id }),
        }),
        button('Start chat', {
          kind: 'primary',
          icon: icons.chat(16),
          onClick: () => {
            void chatOpener.openOrCreateLumiverseChat(char.id).catch((e) => {
              pitchText.classList.remove('ll-pitch-wait')
              pitchText.textContent = errorMessage(e, 'I could not open that chat.')
            })
          },
        }),
      ]),
    ])
    return { el, slot: { char, text: pitchText } }
  }

  async function writePitches(slots: PitchSlot[], token: number): Promise<void> {
    const queue = [...slots]
    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const slot = queue.shift()!
        if (token !== runToken) return
        try {
          const r = await rpc.request({
            type: 'generate_quick_overview',
            characterId: slot.char.id,
          })
          if (token !== runToken) return
          slot.text.classList.remove('ll-pitch-wait')
          slot.text.textContent = r.text
        } catch (e) {
          if (token !== runToken) return
          slot.text.classList.remove('ll-pitch-wait')
          slot.text.replaceChildren(
            h('span', {
              text: errorMessage(e, 'I could not write that one.'),
            }),
          )
        }
      }
    }
    await Promise.all([worker(), worker()])
  }

  function renderCards(
    chars: CharacterSummary[],
    introText: string,
    differentLabel: string,
    token: number,
  ): void {
    const built = chars.map(buildCard)
    resultsBody.replaceChildren(
      intro(introText),
      ...built.map((b) => b.el),
      differentButton(differentLabel),
    )
    void writePitches(
      built.map((b) => b.slot),
      token,
    )
  }

  async function startSurprise(): Promise<void> {
    if (busy) return
    kind = 'surprise'
    const token = ++runToken
    busy = true
    showResults()
    resultsBody.replaceChildren(loadingFrom(ari, SURPRISE_LOADING))
    try {
      const r = await rpc.request({ type: 'picker_surprise' })
      if (token !== runToken) return
      if (!r.character) {
        showMessage(EMPTY_LIBRARY)
        return
      }
      renderCards([r.character], surpriseIntro(), 'Show a different one', token)
    } catch (e) {
      if (token === runToken) {
        showMessage(errorMessage(e, 'Something broke. Try again.'), true)
      }
    } finally {
      if (token === runToken) busy = false
    }
  }

  async function startFind(exclude: boolean): Promise<void> {
    if (busy) return
    kind = 'find'
    const token = ++runToken
    busy = true
    if (!exclude) shownIds = []
    showResults()
    resultsBody.replaceChildren(loadingFrom(ari, SEARCH_LOADING))
    try {
      const r = await rpc.request({
        type: 'picker_find',
        tags: [...selectedTags],
        query: nlInput.value.trim(),
        excludeIds: exclude ? shownIds : undefined,
      })
      if (token !== runToken) return
      if (!r.characters.length) {
        showMessage(exclude ? NO_MORE : NO_MATCHES)
        return
      }
      for (const c of r.characters) {
        if (!shownIds.includes(c.id)) shownIds.push(c.id)
      }
      renderCards(
        r.characters,
        foundIntro(r.characters.length),
        'Show different ones',
        token,
      )
    } catch (e) {
      if (token === runToken) {
        showMessage(errorMessage(e, 'The search fell over. Try again.'), true)
      }
    } finally {
      if (token === runToken) busy = false
    }
  }

  return {
    destroy: () => {
      runToken++
      root.replaceChildren()
    },
  }
}
