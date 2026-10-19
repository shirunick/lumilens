import type { WarmKind } from '../shared/types'
import { deleteCache, getCache } from './cache'
import { getLibrary, invalidateLibrary, type CharacterDTO } from './characters'
import {
  generateDeepDive,
  generateQuickOverview,
  generateTinderDesc,
} from './generate'
import { getSettings } from './settings'
import { createConcurrencyLimit, mapLimit } from './util'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

type CreatedPayload = {
  id?: unknown
  character?: unknown
}

type DeletedPayload = {
  id?: unknown
}

type LibraryChangedPayload = {
  imported?: unknown
  reason?: unknown
  jobId?: unknown
}

let cachedConcurrency = 2
const warmLlmLimit = createConcurrencyLimit(() => cachedConcurrency)
const inFlight = new Map<string, Promise<void>>()
const deletedWhileWarm = new Set<string>()
const knownIds = new Set<string>()
let seedPromise: Promise<void> | null = null
let seeded = false
let unsubs: Array<() => void> = []
const RATE_LIMIT_RETRIES = 3
let rateLimitBackoffMs = [5_000, 15_000, 45_000]
let rateLimitUntil = 0
let rateLimitStrike = 0

class CoolDownSkipError extends Error {
  constructor() {
    super('warm cool-down')
    this.name = 'CoolDownSkipError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b429\b/.test(msg) || /rate[\s_-]?limit/i.test(msg)
}

async function awaitRateLimitClear(): Promise<void> {
  for (;;) {
    const wait = rateLimitUntil - Date.now()
    if (wait <= 0) return
    await sleep(wait)
  }
}

function tripRateLimit(): number {
  const now = Date.now()
  if (now < rateLimitUntil) {
    return rateLimitUntil - now
  }
  const delay =
    rateLimitBackoffMs[
      Math.min(rateLimitStrike, rateLimitBackoffMs.length - 1)
    ] ?? 5_000
  rateLimitStrike = Math.min(rateLimitStrike + 1, rateLimitBackoffMs.length)
  rateLimitUntil = now + delay
  return delay
}

const RUNNERS: Record<
  WarmKind,
  (
    id: string,
    force: boolean,
    userId?: string,
    char?: CharacterDTO,
  ) => Promise<unknown>
> = {
  quick: generateQuickOverview,
  deep: generateDeepDive,
  tinder: generateTinderDesc,
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function previewText(text: unknown, max = 120): string {
  const s = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
  if (!s) return '(empty)'
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

export function characterFromCreatedPayload(
  id: string,
  raw: unknown,
): CharacterDTO {
  const c =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    id,
    name: asString(c.name) || 'Unnamed',
    description: asString(c.description),
    personality: asString(c.personality),
    scenario: asString(c.scenario),
    first_mes: asString(c.first_mes),
    mes_example: asString(c.mes_example),
    creator_notes: asString(c.creator_notes),
    tags: asStringArray(c.tags),
    alternate_greetings: asStringArray(c.alternate_greetings),
    creator: asString(c.creator),
    image_id: typeof c.image_id === 'string' ? c.image_id : null,
    created_at: asOptionalNumber(c.created_at),
    updated_at: asOptionalNumber(c.updated_at),
  }
}

function replaceKnownIds(chars: CharacterDTO[]): void {
  knownIds.clear()
  for (const c of chars) knownIds.add(c.id)
}

async function seedKnownIds(userId?: string): Promise<void> {
  try {
    invalidateLibrary()
    const chars = await getLibrary(userId)
    replaceKnownIds(chars)
    seeded = true
    spindle.log.info(
      `LumiLens warm: seeded known library ids count=${knownIds.size}`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    spindle.log.warn(`LumiLens warm: seed known ids failed: ${msg}`)
  }
}

function ensureSeed(userId?: string): Promise<void> {
  if (seeded) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = seedKnownIds(userId).finally(() => {
      if (!seeded) seedPromise = null
    })
  }
  return seedPromise
}

export function noteUserContext(userId?: string): void {
  if (!userId || seeded) return
  void ensureSeed(userId)
}

async function missingKinds(
  characterId: string,
  kinds: WarmKind[],
): Promise<WarmKind[]> {
  const cache = await getCache(characterId)
  const out: WarmKind[] = []
  for (const kind of kinds) {
    if (kind === 'quick' && !cache?.quickOverview) out.push(kind)
    else if (kind === 'deep' && !cache?.deepDive) out.push(kind)
    else if (kind === 'tinder' && !cache?.tinderDesc) out.push(kind)
  }
  return out
}

async function runWarmKind(
  characterId: string,
  kind: WarmKind,
  userId: string | undefined,
  char: CharacterDTO,
): Promise<{ text?: unknown; cached?: boolean }> {
  let attempt = 0
  for (;;) {
    if (deletedWhileWarm.has(characterId)) {
      return { text: null, cached: true }
    }
    await awaitRateLimitClear()
    try {
      return (await warmLlmLimit.run(
        async () => {
          if (deletedWhileWarm.has(characterId)) {
            return { text: null, cached: true }
          }
          if (Date.now() < rateLimitUntil) {
            throw new CoolDownSkipError()
          }
          spindle.log.info(
            `LumiLens warm: sending LLM request (${kind}) for ${characterId} (${char.name})`,
          )
          try {
            const result = (await RUNNERS[kind](
              characterId,
              false,
              userId,
              char,
            )) as { text?: unknown; cached?: boolean }
            rateLimitStrike = 0
            return result
          } catch (err) {
            if (isRateLimitError(err)) tripRateLimit()
            throw err
          }
        },
        (active, waiting) => {
          spindle.log.info(
            `LumiLens warm: queue (${kind}) for ${characterId} active=${active} waiting=${waiting}`,
          )
        },
      )) as { text?: unknown; cached?: boolean }
    } catch (err) {
      if (err instanceof CoolDownSkipError) continue
      if (!isRateLimitError(err) || attempt >= RATE_LIMIT_RETRIES) throw err
      attempt += 1
      const coolDownMs = Math.max(0, rateLimitUntil - Date.now())
      spindle.log.warn(
        `LumiLens warm: 429 on ${kind} for ${characterId} (${char.name}), retry ${attempt}/${RATE_LIMIT_RETRIES}, global cool-down ${coolDownMs}ms (re-queue behind pending)`,
      )
    }
  }
}

async function warmSeparate(
  characterId: string,
  kinds: WarmKind[],
  userId: string | undefined,
  char: CharacterDTO,
): Promise<void> {
  await mapLimit(kinds, kinds.length, async (kind) => {
    if (deletedWhileWarm.has(characterId)) return
    try {
      const result = await runWarmKind(characterId, kind, userId, char)
      if (deletedWhileWarm.has(characterId)) return
      spindle.log.info(
        `LumiLens warm: result (${kind}) for ${characterId}: cached=${Boolean(result?.cached)} ${previewText(result?.text)}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      spindle.log.warn(
        `LumiLens import warm ${kind} failed for ${characterId}: ${msg}`,
      )
    }
  })
}

async function discardIfDeleted(characterId: string): Promise<boolean> {
  if (!deletedWhileWarm.has(characterId)) return false
  deletedWhileWarm.delete(characterId)
  await deleteCache(characterId)
  spindle.log.info(
    `LumiLens warm: discarded cache for ${characterId} (deleted during warm)`,
  )
  return true
}

export async function warmCharacterOnCreate(
  characterId: string,
  rawCharacter: unknown,
  userId?: string,
): Promise<void> {
  const settings = await getSettings()
  cachedConcurrency = settings.warmOnImportConcurrency
  if (!settings.warmOnImport) {
    spindle.log.info(
      `LumiLens warm: skip ${characterId} (warm on create off)`,
    )
    return
  }
  const kinds = settings.warmOnImportKinds
  if (!kinds.length) {
    spindle.log.info(`LumiLens warm: skip ${characterId} (no kinds selected)`)
    return
  }

  if (deletedWhileWarm.has(characterId)) {
    spindle.log.info(`LumiLens warm: skip ${characterId} (already deleted)`)
    await discardIfDeleted(characterId)
    return
  }

  const todo = await missingKinds(characterId, kinds)
  if (!todo.length) {
    spindle.log.info(
      `LumiLens warm: skip ${characterId} (already cached: ${kinds.join(',')})`,
    )
    return
  }

  const char = characterFromCreatedPayload(characterId, rawCharacter)
  spindle.log.info(
    `LumiLens warm: start ${characterId} (${char.name}) kinds=${todo.join(',')} queue=${inFlight.size} cards llm=${warmLlmLimit.active()}/${cachedConcurrency}`,
  )

  if (await discardIfDeleted(characterId)) return
  await warmSeparate(characterId, todo, userId, char)
  if (await discardIfDeleted(characterId)) return
  spindle.log.info(`LumiLens warm: done ${characterId}`)
}

function enqueueWarm(
  characterId: string,
  character: unknown,
  userId?: string,
): void {
  if (inFlight.has(characterId)) {
    spindle.log.info(
      `LumiLens warm: already in flight for ${characterId}, skip duplicate`,
    )
    return
  }
  const run = warmCharacterOnCreate(characterId, character, userId)
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      spindle.log.warn(`LumiLens import warm failed for ${characterId}: ${msg}`)
    })
    .finally(() => {
      if (inFlight.get(characterId) === run) inFlight.delete(characterId)
    })
  inFlight.set(characterId, run)
}

function pickNewest(chars: CharacterDTO[], limit: number): CharacterDTO[] {
  return [...chars]
    .sort((a, b) => {
      const au = a.updated_at ?? a.created_at ?? 0
      const bu = b.updated_at ?? b.created_at ?? 0
      if (bu !== au) return bu - au
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    .slice(0, limit)
}

function onCharacterCreated(payload: unknown, userId?: string): void {
  const body =
    payload && typeof payload === 'object'
      ? (payload as CreatedPayload)
      : null
  const id = typeof body?.id === 'string' ? body.id : ''
  const name =
    body?.character &&
    typeof body.character === 'object' &&
    typeof (body.character as { name?: unknown }).name === 'string'
      ? (body.character as { name: string }).name
      : '?'
  if (!id) {
    spindle.log.warn('LumiLens warm: CHARACTER_CREATED without id, ignore')
    return
  }
  deletedWhileWarm.delete(id)
  knownIds.add(id)
  noteUserContext(userId)
  spindle.log.info(
    `LumiLens warm: char create notice id=${id} name=${name} user=${userId ?? '(none)'}`,
  )
  enqueueWarm(id, body?.character, userId)
}

async function onCharacterDeleted(payload: unknown): Promise<void> {
  const body =
    payload && typeof payload === 'object'
      ? (payload as DeletedPayload)
      : null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) {
    spindle.log.warn('LumiLens warm: CHARACTER_DELETED without id, ignore')
    return
  }
  deletedWhileWarm.add(id)
  knownIds.delete(id)
  invalidateLibrary()
  const removed = await deleteCache(id)
  spindle.log.info(
    `LumiLens warm: char delete notice id=${id} cache=${removed ? 'removed' : 'absent'}`,
  )
}

async function onLibraryChanged(
  payload: unknown,
  userId?: string,
): Promise<void> {
  const body =
    payload && typeof payload === 'object'
      ? (payload as LibraryChangedPayload)
      : null
  const imported =
    typeof body?.imported === 'number' && Number.isFinite(body.imported)
      ? Math.floor(body.imported)
      : 0
  const reason = typeof body?.reason === 'string' ? body.reason : '?'
  if (imported <= 0) {
    spindle.log.info(
      `LumiLens warm: library change ignore reason=${reason} imported=${imported}`,
    )
    return
  }

  invalidateLibrary()
  let chars: CharacterDTO[]
  try {
    chars = await getLibrary(userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    spindle.log.warn(`LumiLens warm: library list after change failed: ${msg}`)
    return
  }

  const haveBaseline = knownIds.size > 0
  const candidates = haveBaseline
    ? chars.filter((c) => !knownIds.has(c.id))
    : chars
  const targets = pickNewest(candidates, imported)
  replaceKnownIds(chars)
  seeded = true

  spindle.log.info(
    `LumiLens warm: library change reason=${reason} imported=${imported} baseline=${haveBaseline ? 'diff' : 'newest'} fresh=${candidates.length} warming=${targets.length}`,
  )

  const settings = await getSettings()
  if (!settings.warmOnImport || !settings.warmOnImportKinds.length) {
    spindle.log.info('LumiLens warm: library change skipped (warm off or no kinds)')
    return
  }

  for (const char of targets) {
    deletedWhileWarm.delete(char.id)
    enqueueWarm(char.id, char, userId)
  }
}

function stopImportWarmListener(): void {
  for (const u of unsubs) u()
  unsubs = []
}

export function startImportWarmListener(): () => void {
  if (unsubs.length) return stopImportWarmListener
  const api = spindle as typeof spindle & {
    on?: (
      event: string,
      handler: (payload: unknown, userId?: string) => void,
    ) => () => void
  }
  if (typeof api.on !== 'function') {
    spindle.log.warn(
      'LumiLens: spindle.on missing, warm on create is disabled',
    )
    return () => {}
  }
  unsubs = [
    api.on('CHARACTER_CREATED', (payload, userId) => {
      onCharacterCreated(payload, userId)
    }),
    api.on('CHARACTER_DELETED', (payload) => {
      void onCharacterDeleted(payload)
    }),
    api.on('CHARACTER_LIBRARY_CHANGED', (payload, userId) => {
      void onLibraryChanged(payload, userId)
    }),
  ]
  spindle.log.info(
    'LumiLens: listening for CHARACTER_CREATED / CHARACTER_DELETED / CHARACTER_LIBRARY_CHANGED',
  )
  return stopImportWarmListener
}

export function __resetImportWarmForTests(): void {
  for (const u of unsubs) u()
  unsubs = []
  inFlight.clear()
  deletedWhileWarm.clear()
  knownIds.clear()
  seedPromise = null
  seeded = false
  cachedConcurrency = 2
  rateLimitBackoffMs = [5_000, 15_000, 45_000]
  rateLimitUntil = 0
  rateLimitStrike = 0
  warmLlmLimit.reset()
}

export function __setRateLimitBackoffForTests(ms: number[]): void {
  rateLimitBackoffMs = ms.length ? [...ms] : [0]
}

export function __enqueueWarmForTests(
  characterId: string,
  character: unknown,
  userId?: string,
): Promise<void> {
  enqueueWarm(characterId, character, userId)
  return inFlight.get(characterId) ?? Promise.resolve()
}

export async function __settleImportWarmForTests(): Promise<void> {
  await Promise.allSettled([...inFlight.values()])
}

export async function __awaitSeedForTests(): Promise<void> {
  await ensureSeed()
}

export function __knownIdsForTests(): string[] {
  return [...knownIds]
}
