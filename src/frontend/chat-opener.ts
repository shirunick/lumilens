import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { escapeAttribute, escapeHtml } from './html'
import { modalWidth, showSafeModal } from './safe-modal'
import { errorMessage } from './ui'

type ChoiceAction = { pending: string; task: () => Promise<void> }

type CharacterLike = {
  id?: string
  name?: string
  first_mes?: string
  alternate_greetings?: string[]
}

type ChatLike = {
  id?: string
  name?: string
  message_count?: number
  created_at?: number
  updated_at?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChatLike(value: unknown): value is ChatLike {
  return isRecord(value)
}

function isCharacterLike(value: unknown): value is CharacterLike {
  return isRecord(value)
}

function alternatesOf(character: CharacterLike | null): string[] {
  const list = character?.alternate_greetings
  return Array.isArray(list) ? list : []
}

function normalizeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

async function readJson(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => ({}))
  const record = isRecord(payload) ? payload : null
  if (!response.ok || record?.success === false) {
    throw new Error(String(record?.error || `HTTP ${response.status}`))
  }
  return payload
}

function localChatDate(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return ''
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export type ChatOpenerDeps = {
  ctx: SpindleFrontendContext

  onError?: (message: string) => void
}

export function createChatOpener(deps: ChatOpenerDeps) {
  const { ctx } = deps
  let chatOpeningId: string | null = null

  function navigateLumiverseChatInPlace(chatId: string): void {
    const id = normalizeId(chatId)
    if (!id) throw new Error('Lumiverse gave me nothing I could open.')
    const target = `/chat/${encodeURIComponent(id)}`
    if (window.location.pathname === target) return

    const currentState =
      window.history.state && typeof window.history.state === 'object'
        ? (window.history.state as Record<string, unknown>)
        : {}
    const currentIndex = Number(currentState.idx)
    window.history.pushState(
      {
        ...currentState,
        usr: null,
        key: Math.random().toString(36).slice(2, 10),
        idx: Number.isFinite(currentIndex) ? currentIndex + 1 : 1,
      },
      '',
      target,
    )
    window.dispatchEvent(
      new PopStateEvent('popstate', { state: window.history.state }),
    )
  }

  async function createLumiverseChat(
    characterId: string,
    greetingIndex?: number,
  ): Promise<string> {
    const body: Record<string, unknown> = { character_id: characterId }
    if (Number.isInteger(greetingIndex)) body.greeting_index = greetingIndex
    const response = await fetch('/api/v1/chats', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const chat = await readJson(response)
    const chatId = normalizeId(isChatLike(chat) ? chat.id : '')
    if (!chatId) throw new Error('Lumiverse gave me nothing I could open.')
    return chatId
  }

  async function getCharacter(characterId: string): Promise<CharacterLike | null> {
    try {
      if (ctx.characters?.get) {
        const c: unknown = await ctx.characters.get(characterId)
        return isCharacterLike(c) ? c : null
      }
    } catch {
      return null
    }
    return null
  }

  function showChoiceModal(
    title: string,
    lead: string,
    choicesHtml: string,
    onChoose: (
      button: HTMLButtonElement,
      modal: { dismiss: () => void },
    ) => ChoiceAction | void,
  ): void {
    const modal = showSafeModal(ctx, {
      title,
      width: modalWidth('medium'),
      maxHeight: Math.max(420, Math.min(720, window.innerHeight - 32)),
    })
    modal.root.innerHTML = `
      <div class="ll-chat-picker">
        <p class="ll-muted">${escapeHtml(lead)}</p>
        ${choicesHtml}
        <div class="ll-chat-picker-error" data-chat-picker-error></div>
      </div>`
    modal.root.addEventListener('click', async (event) => {
      const button = (event.target as Element).closest('button')
      if (!(button instanceof HTMLButtonElement) || button.disabled) return
      const action = onChoose(button, modal)
      if (!action) return
      const buttons = [...modal.root.querySelectorAll('button')]
      for (const item of buttons) item.disabled = true
      const errorHost = modal.root.querySelector('[data-chat-picker-error]')
      if (errorHost) errorHost.textContent = action.pending
      try {
        await action.task()
      } catch (error) {
        const message = errorMessage(error, 'I could not create that chat.')
        if (errorHost) errorHost.textContent = message
        for (const item of buttons) item.disabled = false
        deps.onError?.(message)
      }
    })
  }

  function showLumiverseGreetingPicker(
    characterId: string,
    character: CharacterLike | null,
    alternates: string[],
  ): void {
    const greetings = [
      {
        label: 'Default greeting',
        content: String(character?.first_mes || ''),
      },
      ...alternates.map((content, index) => ({
        label: `Greeting ${index + 2}`,
        content: String(content || ''),
      })),
    ]
    const choicesHtml = greetings
      .map(
        (greeting, index) => `
          <button class="ll-chat-choice" type="button" data-greeting-index="${index}">
            <span class="ll-chat-choice-head">
              <span class="ll-chat-choice-label">${escapeHtml(greeting.label)}</span>
            </span>
            <span class="ll-chat-choice-preview">${escapeHtml(greeting.content)}</span>
          </button>`,
      )
      .join('')
    showChoiceModal(
      'Pick a greeting',
      `${greetings.length} ways to open. Pick the one you like.`,
      choicesHtml,
      (button, modal) => {
        const greetingIndex = Number(button.dataset.greetingIndex)
        if (!Number.isInteger(greetingIndex)) return
        return {
          pending: 'Setting up the chat.',
          task: async () => {
            const chatId = await createLumiverseChat(characterId, greetingIndex)
            modal.dismiss()
            navigateLumiverseChatInPlace(chatId)
          },
        }
      },
    )
  }

  async function startNewLumiverseChat(characterId: string): Promise<void> {
    const character = await getCharacter(characterId)
    const alternates = alternatesOf(character)
    if (alternates.length > 0) {
      showLumiverseGreetingPicker(characterId, character, alternates)
      return
    }
    const chatId = await createLumiverseChat(characterId)
    navigateLumiverseChatInPlace(chatId)
  }

  function showLumiverseChatPicker(
    characterId: string,
    character: CharacterLike | null,
    chats: ChatLike[],
  ): void {
    const characterName = String(character?.name || 'character')
    const choicesHtml = `
        <button class="ll-chat-choice" type="button" data-new-chat>
          <span class="ll-chat-choice-label">+ New chat</span>
        </button>
        ${chats
          .map((chat, index) => {
            const created = localChatDate(chat?.created_at)
            const name =
              String(chat?.name || '').trim() ||
              `Chat${created ? ` from ${created}` : ''}`
            const messageCount = Number(chat?.message_count)
            const meta = [
              Number.isFinite(messageCount)
                ? `${messageCount} message${messageCount === 1 ? '' : 's'}`
                : '',
              localChatDate(chat?.updated_at),
            ]
              .filter(Boolean)
              .join(' · ')
            return `
              <button class="ll-chat-choice" type="button" data-existing-chat="${escapeAttribute(String(chat?.id || ''))}">
                <span class="ll-chat-choice-head">
                  <span class="ll-chat-choice-label">${escapeHtml(name)}</span>
                  ${index === 0 ? '<span class="ll-chat-choice-badge">Most recent</span>' : ''}
                </span>
                ${meta ? `<span class="ll-chat-choice-meta">${escapeHtml(meta)}</span>` : ''}
              </button>`
          })
          .join('')}`
    showChoiceModal(
      `Chats with ${characterName}`,
      'You two have talked before. Pick up where you left off, or start fresh.',
      choicesHtml,
      (button, modal) => {
        if (button.dataset.existingChat !== undefined) {
          const chatId = normalizeId(button.dataset.existingChat)
          if (!chatId) return
          modal.dismiss()
          navigateLumiverseChatInPlace(chatId)
          return
        }
        if (button.dataset.newChat === undefined) return
        return {
          pending: 'Setting up a new chat.',
          task: async () => {
            const alternates = alternatesOf(character)
            if (alternates.length > 0) {
              modal.dismiss()
              showLumiverseGreetingPicker(characterId, character, alternates)
            } else {
              const chatId = await createLumiverseChat(characterId)
              modal.dismiss()
              navigateLumiverseChatInPlace(chatId)
            }
          },
        }
      },
    )
  }

  async function openOrCreateLumiverseChat(characterId: string): Promise<void> {
    const id = normalizeId(characterId)
    if (!id || chatOpeningId) return
    chatOpeningId = id
    try {
      const chatsResponse = await fetch(
        `/api/v1/chats/character-chats/${encodeURIComponent(id)}`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        },
      )
      const payload = await readJson(chatsResponse)
      const chats = Array.isArray(payload) ? payload.filter(isChatLike) : []
      if (chats.length > 1) {
        const character = await getCharacter(id)
        showLumiverseChatPicker(id, character, chats)
      } else if (chats.length === 1) {
        navigateLumiverseChatInPlace(chats[0].id || '')
      } else {
        await startNewLumiverseChat(id)
      }
    } catch (error) {
      const message = errorMessage(error, 'I could not open that chat.')
      deps.onError?.(message)
      throw error
    } finally {
      chatOpeningId = null
    }
  }

  return {
    openOrCreateLumiverseChat,
    navigateLumiverseChatInPlace,
    createLumiverseChat,
    startNewLumiverseChat,

    _isBusy: () => chatOpeningId !== null,
  }
}

export type ChatOpener = ReturnType<typeof createChatOpener>
