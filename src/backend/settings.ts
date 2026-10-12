import { STORAGE } from '../shared/constants'
import {
  DEFAULT_SETTINGS,
  LLM_ACTIONS,
  WARM_KINDS,
  type LlmAction,
  type Settings,
  type WarmKind,
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

export function normalizeWarmOnImportKinds(raw: unknown): WarmKind[] {
  const allowed = new Set<WarmKind>(WARM_KINDS)
  const out: WarmKind[] = []
  const seen = new Set<WarmKind>()
  if (!Array.isArray(raw)) return [...DEFAULT_SETTINGS.warmOnImportKinds]
  for (const k of raw) {
    if (typeof k !== 'string') continue
    if (!allowed.has(k as WarmKind)) continue
    const kind = k as WarmKind
    if (seen.has(kind)) continue
    seen.add(kind)
    out.push(kind)
  }
  return out.length > 0 ? out : [...DEFAULT_SETTINGS.warmOnImportKinds]
}

export function normalizeWarmOnImportConcurrency(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : DEFAULT_SETTINGS.warmOnImportConcurrency
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.warmOnImportConcurrency
  return Math.min(8, Math.max(1, Math.round(n)))
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
  return {
    ...s,
    connectionsByAction: { ...s.connectionsByAction },
    warmOnImportKinds: [...s.warmOnImportKinds],
  }
}

export function resetSettingsMemo(): void {
  memo = null
}

function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_SETTINGS,
      connectionsByAction: {},
      warmOnImportKinds: [...DEFAULT_SETTINGS.warmOnImportKinds],
    }
  }
  return {
    connectionId: typeof raw.connectionId === 'string' ? raw.connectionId : null,
    testingMode: raw.testingMode === true,
    perActionConnections: raw.perActionConnections === true,
    connectionsByAction: normalizeConnectionsByAction(raw.connectionsByAction),
    warmOnImport: raw.warmOnImport === true,
    warmOnImportKinds: normalizeWarmOnImportKinds(raw.warmOnImportKinds),
    warmOnImportConcurrency: normalizeWarmOnImportConcurrency(
      raw.warmOnImportConcurrency,
    ),
  }
}

export async function getSettings(): Promise<Settings> {
  if (memo) return copySettings(memo)
  try {
    const raw = await spindle.storage.getJson<Partial<Settings> | null>(
      STORAGE.settings,
      { fallback: null },
    )
    const next = normalizeSettings(raw)
    memo = next
    return copySettings(next)
  } catch {
    return copySettings(DEFAULT_SETTINGS)
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
    warmOnImport:
      patch.warmOnImport !== undefined
        ? patch.warmOnImport === true
        : current.warmOnImport,
    warmOnImportKinds:
      patch.warmOnImportKinds !== undefined
        ? normalizeWarmOnImportKinds(patch.warmOnImportKinds)
        : current.warmOnImportKinds,
    warmOnImportConcurrency:
      patch.warmOnImportConcurrency !== undefined
        ? normalizeWarmOnImportConcurrency(patch.warmOnImportConcurrency)
        : current.warmOnImportConcurrency,
  }
  await spindle.storage.setJson(STORAGE.settings, next)
  memo = next
  return copySettings(next)
}
