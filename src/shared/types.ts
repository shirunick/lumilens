export interface CacheEntry {
  quickOverview: string | null
  deepDive: string | null
  tinderDesc: string | null
  generatedAt: number
  modelUsed: string | null
}

export type LlmAction = 'quick' | 'deep' | 'tinder' | 'search'

export const LLM_ACTIONS: readonly LlmAction[] = [
  'quick',
  'deep',
  'tinder',
  'search',
]

export interface Settings {
  connectionId: string | null
  testingMode: boolean
  perActionConnections: boolean
  connectionsByAction: Partial<Record<LlmAction, string | null>>
}

export type TinderMode = 'out' | 'chat'

export type WarmKind = 'quick' | 'deep' | 'tinder'

export type TinderAction =
  | 'keep'
  | 'delete'
  | 'delete_mock'
  | 'accept'
  | 'decline'

export interface TinderHistoryEntry {
  id: string
  action: TinderAction
}

export interface TinderQueue {
  mode: TinderMode
  remainingIds: string[]
  history: TinderHistoryEntry[]
  kept: number
  deleted: number
  declined: number
  accepted: number
}

export interface CharacterSummary {
  id: string
  name: string
  description: string
  tags: string[]
  creator: string
  creator_notes: string
  image_id: string | null
  imageUrl: string | null
  personality?: string
  scenario?: string
  first_mes?: string
  mes_example?: string
  alternate_greetings?: string[]
}

export interface ConnectionInfo {
  id: string
  name: string
  provider: string
  model: string
  is_default: boolean
  has_api_key: boolean
}

export interface TinderProgress {
  current: number
  total: number
  kept: number
  deleted: number
  declined: number
  accepted: number
  remaining: number
}

export interface TinderCardView {
  character: CharacterSummary
  tinderDesc: string | null
  progress: TinderProgress
}

export const DEFAULT_SETTINGS: Settings = {
  connectionId: null,
  testingMode: false,
  perActionConnections: false,
  connectionsByAction: {},
}

export const EMPTY_CACHE: CacheEntry = {
  quickOverview: null,
  deepDive: null,
  tinderDesc: null,
  generatedAt: 0,
  modelUsed: null,
}

export function emptyTinderQueue(mode: TinderMode): TinderQueue {
  return {
    mode,
    remainingIds: [],
    history: [],
    kept: 0,
    deleted: 0,
    declined: 0,
    accepted: 0,
  }
}
