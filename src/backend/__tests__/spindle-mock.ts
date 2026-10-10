import { EMPTY_CACHE, type CacheEntry, type Settings } from '../../shared/types'
import { invalidateLibrary } from '../characters'
import { resetSettingsMemo } from '../settings'
import { resetWarmEstimate } from '../warm-library'

export type MockCharacter = {
  id: string
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  creator_notes: string
  tags: string[]
  alternate_greetings: string[]
  creator: string
  image_id: string | null
}

type JsonStore = Map<string, unknown>
type BinaryStore = Map<string, Uint8Array>

export function createSpindleMock(opts?: {
  characters?: MockCharacter[]
  generateContent?: string | ((messages: unknown[]) => string)
  connections?: Array<{
    id: string
    name: string
    provider: string
    model: string
    is_default: boolean
    has_api_key: boolean
  }>
  ariBytes?: Uint8Array
}) {
  const characters = [...(opts?.characters ?? [])]
  const json: JsonStore = new Map()
  const binary: BinaryStore = new Map()
  const frontendMessages: unknown[] = []
  const logs: string[] = []

  if (opts?.ariBytes) {
    binary.set('ari.png', opts.ariBytes)
  }

  const api = {
    characters: {
      list: async ({ limit = 50, offset = 0 } = {}) => {
        const data = characters.slice(offset, offset + limit)
        return { data, total: characters.length }
      },
      get: async (id: string, _userId?: string) =>
        characters.find((c) => c.id === id) ?? null,
      delete: async (id: string, _userId?: string) => {
        const idx = characters.findIndex((c) => c.id === id)
        if (idx < 0) return false
        characters.splice(idx, 1)
        return true
      },
    },
    images: {
      get: async (imageId: string) => {
        if (!imageId) return null
        return { id: imageId, url: `/api/v1/images/${imageId}?size=sm` }
      },
    },
    connections: {
      list: async () =>
        opts?.connections ?? [
          {
            id: 'conn-1',
            name: 'Default',
            provider: 'openai',
            model: 'gpt-test',
            is_default: true,
            has_api_key: true,
          },
        ],
    },
    generate: {
      quiet: async ({ messages }: { messages: unknown[] }) => {
        const content =
          typeof opts?.generateContent === 'function'
            ? opts.generateContent(messages)
            : (opts?.generateContent ?? 'Generated text from Ari.')
        return { content, finish_reason: 'stop', usage: {} }
      },
    },
    storage: {
      getJson: async <T>(
        path: string,
        options?: { fallback?: T },
      ): Promise<T> => {
        if (!json.has(path)) {
          return (options?.fallback as T) ?? (null as T)
        }
        return json.get(path) as T
      },
      setJson: async (path: string, value: unknown) => {
        json.set(path, value)
      },
      readBinary: async (path: string) => {
        const b = binary.get(path)
        if (!b) throw new Error('missing binary')
        return b
      },
    },
    sendToFrontend: (payload: unknown) => {
      frontendMessages.push(payload)
    },
    onFrontendMessage: (handler: (payload: unknown, userId: string) => void) => {
      ;(api as { __feHandler?: typeof handler }).__feHandler = handler
      return () => {
        delete (api as { __feHandler?: typeof handler }).__feHandler
      }
    },
    log: {
      info: (msg: string) => {
        logs.push(msg)
      },
    },

    __json: json,
    __binary: binary,
    __characters: characters,
    __frontendMessages: frontendMessages,
    __logs: logs,
    __feHandler: undefined as
      | ((payload: unknown, userId: string) => void)
      | undefined,
    __setCache: (id: string, entry: Partial<CacheEntry>) => {
      json.set(`cache_v2/${id}.json`, { ...EMPTY_CACHE, ...entry })
    },
    __setSettings: (s: Partial<Settings>) => {
      json.set('settings.json', s)
      resetSettingsMemo()
    },
  }

  return api
}

export function installSpindleMock(api: ReturnType<typeof createSpindleMock>) {
  ;(globalThis as { spindle?: unknown }).spindle = api
  invalidateLibrary()
  resetSettingsMemo()
  resetWarmEstimate()
  return api
}

export function sampleCharacters(): MockCharacter[] {
  return [
    {
      id: 'c1',
      name: 'Vampire Lord',
      description: 'A brooding vampire with a redemption arc',
      personality: 'Brooding, lonely',
      scenario: 'Gothic castle',
      first_mes: 'Welcome, mortal.',
      mes_example: '{{user}}: Hi\n{{char}}: Hmm.',
      creator_notes: 'Soft horror',
      tags: ['Horror', 'Fantasy', 'Vampire'],
      alternate_greetings: ['Another night begins.'],
      creator: 'AuthorA',
      image_id: 'img1',
    },
    {
      id: 'c2',
      name: 'Space Cadet',
      description: 'Optimistic explorer of the stars',
      personality: 'Cheerful',
      scenario: 'Spaceship',
      first_mes: 'Engines ready!',
      mes_example: '',
      creator_notes: '',
      tags: ['Sci-Fi', 'Adventure'],
      alternate_greetings: [],
      creator: 'AuthorB',
      image_id: null,
    },
    {
      id: 'c3',
      name: 'Bakery Ghost',
      description: 'Haunts a cozy bakery',
      personality: 'Shy fluff',
      scenario: 'Bakery at dawn',
      first_mes: 'Would you like a pastry?',
      mes_example: '',
      creator_notes: 'Slice of life ghost',
      tags: ['Slice of Life', 'Fluff', 'Supernatural'],
      alternate_greetings: [],
      creator: 'AuthorC',
      image_id: 'img3',
    },
  ]
}
