import type {
  CharacterSummary,
  ConnectionInfo,
  Settings,
  TinderCardView,
  TinderMode,
  WarmKind,
} from './types'

export interface RequestBase {
  requestId: string
}

export type FrontendToBackend =
  | (RequestBase & { type: 'get_settings' })
  | (RequestBase & { type: 'set_settings'; settings: Partial<Settings> })
  | (RequestBase & { type: 'list_connections' })
  | (RequestBase & { type: 'get_ari_avatar' })
  | (RequestBase & { type: 'get_quick_view'; characterId: string })
  | (RequestBase & {
      type: 'generate_quick_overview'
      characterId: string
      force?: boolean
    })
  | (RequestBase & {
      type: 'generate_deep_dive'
      characterId: string
      force?: boolean
    })
  | (RequestBase & {
      type: 'generate_tinder_desc'
      characterId: string
      force?: boolean
    })
  | (RequestBase & { type: 'picker_surprise' })
  | (RequestBase & {
      type: 'picker_find'
      tags: string[]
      query: string
      excludeIds?: string[]
    })
  | (RequestBase & { type: 'tinder_init'; mode: TinderMode })
  | (RequestBase & {
      type: 'tinder_swipe'
      direction: 'left' | 'right'
    })
  | (RequestBase & { type: 'tinder_undo' })
  | (RequestBase & { type: 'tinder_reshuffle' })
  | (RequestBase & { type: 'clear_cache_kind'; kind: WarmKind })
  | (RequestBase & { type: 'warm_library_estimate'; kinds: WarmKind[] })
  | (RequestBase & { type: 'warm_library_start'; kinds: WarmKind[] })
  | (RequestBase & { type: 'warm_library_cancel' })
  | (RequestBase & {
      type: 'resolve_character_by_name'
      name?: string
      candidateIds?: string[]
    })

export type BackendToFrontend =
  | {
      type: 'get_settings_result'
      requestId: string
      settings: Settings
    }
  | {
      type: 'set_settings_result'
      requestId: string
      settings: Settings
    }
  | {
      type: 'list_connections_result'
      requestId: string
      connections: ConnectionInfo[]
    }
  | {
      type: 'get_ari_avatar_result'
      requestId: string
      dataUrl: string | null
    }
  | {
      type: 'get_quick_view_result'
      requestId: string
      character: CharacterSummary
      quickOverview: string | null
      deepDive: string | null
    }
  | {
      type: 'generate_quick_overview_result'
      requestId: string
      text: string
      cached: boolean
    }
  | {
      type: 'generate_deep_dive_result'
      requestId: string
      text: string
      cached: boolean
    }
  | {
      type: 'generate_tinder_desc_result'
      requestId: string
      text: string
      cached: boolean
    }
  | {
      type: 'picker_surprise_result'
      requestId: string
      character: CharacterSummary | null
    }
  | {
      type: 'picker_find_result'
      requestId: string
      characters: CharacterSummary[]
      usedLlm: boolean
    }
  | {
      type: 'tinder_init_result'
      requestId: string
      card: TinderCardView | null
      empty: boolean
    }
  | {
      type: 'tinder_swipe_result'
      requestId: string
      card: TinderCardView | null
      empty: boolean
      action: string
    }
  | {
      type: 'tinder_undo_result'
      requestId: string
      card: TinderCardView | null
      empty: boolean
    }
  | {
      type: 'tinder_reshuffle_result'
      requestId: string
      card: TinderCardView | null
      empty: boolean
    }
  | {
      type: 'clear_cache_kind_result'
      requestId: string
      kind: WarmKind
      cleared: number
    }
  | {
      type: 'warm_library_estimate_result'
      requestId: string
      jobs: number
      cards: number
      inputTokensApprox: number
      breakdown: { quick: number; deep: number; tinder: number }
    }
  | {
      type: 'warm_library_start_result'
      requestId: string
      total: number
    }
  | {
      type: 'warm_library_cancel_result'
      requestId: string
      cancelled: boolean
    }
  | {
      type: 'resolve_character_by_name_result'
      requestId: string
      character: CharacterSummary | null
    }
  | {
      type: 'warm_library_progress'
      done: number
      total: number
      failed: number
      currentName: string | null
    }
  | {
      type: 'warm_library_done'
      done: number
      total: number
      failed: number
      cancelled: boolean
    }
  | {
      type: 'error'
      requestId: string
      message: string
      code?: string
    }

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

export type RequestType = FrontendToBackend['type']

export type RequestOf<K extends RequestType> = Extract<
  FrontendToBackend,
  { type: K }
>

export type RequestBody<K extends RequestType> = DistributiveOmit<
  RequestOf<K>,
  'requestId'
>

export type ResultFor<K extends RequestType> = Extract<
  BackendToFrontend,
  { type: `${K}_result` }
>

export type ResultBody<K extends RequestType> = DistributiveOmit<
  ResultFor<K>,
  'requestId'
>

export function isFrontendMessage(payload: unknown): payload is FrontendToBackend {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    typeof (payload as { type: unknown }).type === 'string' &&
    'requestId' in payload &&
    typeof (payload as { requestId: unknown }).requestId === 'string'
  )
}
