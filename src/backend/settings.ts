import { STORAGE } from '../shared/constants'
import {
  DEFAULT_SETTINGS,
  LLM_ACTIONS,
  type LlmAction,
  type Settings,
} from '../shared/types'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

function normalizeConnectionsByAction(
  raw: unknown,
): Partial<Record<LlmAction, string | null>> {
  if (!raw || typeof raw !== 'object') return {}
  const src = raw as Record<string, unknown>
  const out: Partial<Record<LlmAction, string | null>> = {}
  for (const action of LLM_ACTIONS) {
    if (!(action in src)) continue
    const v = src[action]
    if (v === null) out[action] = null
    else if (typeof v === 'string') out[action] = v
  }
  return out
}

export function resolveConnectionId(
  settings: Settings,
  action: LlmAction,
): string | null {
  if (settings.perActionConnections) {
    const specific = settings.connectionsByAction[action]
    if (specific !== undefined) return specific
  }
  return settings.connectionId
}

let memo: Settings | null = null

function copySettings(s: Settings): Settings {
  return { ...s, connectionsByAction: { ...s.connectionsByAction } }
}

export function resetSettingsMemo(): void {
  memo = null
}

export async function getSettings(): Promise<Settings> {
  if (memo) return copySettings(memo)
  try {
    const raw = await spindle.storage.getJson<Partial<Settings> | null>(
      STORAGE.settings,
      { fallback: null },
    )
    const next: Settings =
      !raw || typeof raw !== 'object'
        ? { ...DEFAULT_SETTINGS, connectionsByAction: {} }
        : {
            connectionId:
              typeof raw.connectionId === 'string' ? raw.connectionId : null,
            testingMode: raw.testingMode === true,
            perActionConnections: raw.perActionConnections === true,
            connectionsByAction: normalizeConnectionsByAction(
              raw.connectionsByAction,
            ),
          }
    memo = next
    return copySettings(next)
  } catch {
    return { ...DEFAULT_SETTINGS, connectionsByAction: {} }
  }
}

export async function setSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings()
  const next: Settings = {
    connectionId:
      patch.connectionId !== undefined
        ? patch.connectionId
        : current.connectionId,
    testingMode:
      patch.testingMode !== undefined
        ? patch.testingMode
        : current.testingMode,
    perActionConnections:
      patch.perActionConnections !== undefined
        ? patch.perActionConnections
        : current.perActionConnections,
    connectionsByAction:
      patch.connectionsByAction !== undefined
        ? normalizeConnectionsByAction(patch.connectionsByAction)
        : current.connectionsByAction,
  }
  await spindle.storage.setJson(STORAGE.settings, next)
  memo = next
  return copySettings(next)
}
