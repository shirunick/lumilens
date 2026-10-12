import type { WarmKind } from '../shared/types'
import { deleteCache, getCache } from './cache'
import { invalidateLibrary, type CharacterDTO } from './characters'
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

let cachedConcurrency = 2
const warmLlmLimit = createConcurrencyLimit(() => cachedConcurrency)
const inFlight = new Map<string, Promise<void>>()
const deletedWhileWarm = new Set<string>()
let unsubs: Array<() => void> = []

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
  }
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

async function warmSeparate(
  characterId: string,
  kinds: WarmKind[],
  userId: string | undefined,
  char: CharacterDTO,
): Promise<void> {
  await mapLimit(kinds, kinds.length, async (kind) => {
    if (deletedWhileWarm.has(characterId)) return
    try {
      const result = (await warmLlmLimit.run(
        async () => {
          if (deletedWhileWarm.has(characterId)) {
            return { text: null, cached: true }
          }
          spindle.log.info(
            `LumiLens warm: sending LLM request (${kind}) for ${characterId} (${char.name})`,
          )
          return (await RUNNERS[kind](
            characterId,
            false,
            userId,
            char,
          )) as { text?: unknown; cached?: boolean }
        },
        (active, waiting) => {
          spindle.log.info(
            `LumiLens warm: queue (${kind}) for ${characterId} active=${active} waiting=${waiting}`,
          )
        },
      )) as { text?: unknown; cached?: boolean }
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
  invalidateLibrary()
  const removed = await deleteCache(id)
  spindle.log.info(
    `LumiLens warm: char delete notice id=${id} cache=${removed ? 'removed' : 'absent'}`,
  )
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
  ]
  spindle.log.info(
    'LumiLens: listening for CHARACTER_CREATED / CHARACTER_DELETED',
  )
  return stopImportWarmListener
}

export function __resetImportWarmForTests(): void {
  for (const u of unsubs) u()
  unsubs = []
  inFlight.clear()
  deletedWhileWarm.clear()
  cachedConcurrency = 2
  warmLlmLimit.reset()
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
