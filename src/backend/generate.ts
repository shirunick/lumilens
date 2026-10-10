import type { LlmAction, WarmKind } from '../shared/types'
import { getCache, setCache } from './cache'
import { getCharacter, type CharacterDTO } from './characters'
import { getSettings, resolveConnectionId } from './settings'
import { buildDeepDiveMessages } from './prompts/deep-dive'
import { buildQuickOverviewMessages } from './prompts/quick-overview'
import { buildTinderDescMessages } from './prompts/tinder-desc'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

export class GenerateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerateError'
  }
}

function ariFail(reason: string): never {
  throw new GenerateError(
    `I could not finish that. ${reason} Try again when you are ready.`,
  )
}

export function stripDashes(text: string): string {
  return text.replace(/\s*\u2014\s*/g, ', ').replace(/\s+\u2013\s+/g, ', ')
}

async function quietGenerate(
  messages: Array<{ role: string; content: string }>,
  action: LlmAction,
  userId?: string,
): Promise<{ content: string; model: string | null }> {
  const settings = await getSettings()
  const connectionId = resolveConnectionId(settings, action)
  try {
    const result = (await spindle.generate.quiet({
      type: 'quiet',
      messages: messages as Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
      }>,
      ...(connectionId ? { connection_id: connectionId } : {}),
      ...(userId ? { userId } : {}),
    } as Parameters<typeof spindle.generate.quiet>[0])) as {
      content?: unknown
      model?: unknown
    } | null
    const content = stripDashes(String(result?.content ?? '')).trim()
    if (!content) ariFail('The model returned nothing useful.')
    const model =
      typeof (result as { model?: unknown })?.model === 'string'
        ? String((result as { model: string }).model)
        : null
    return { content, model }
  } catch (err) {
    if (err instanceof GenerateError) throw err
    const msg = err instanceof Error ? err.message : 'Unknown generation error.'
    ariFail(msg)
  }
}

type Messages = Array<{ role: string; content: string }>
type GenerateResult = { text: string; cached: boolean }

export function toQuickOverviewInput(
  char: CharacterDTO,
): Parameters<typeof buildQuickOverviewMessages>[0] {
  return {
    name: char.name,
    description: char.description,
    personality: char.personality,
    scenario: char.scenario,
    first_mes: char.first_mes,
    tags: char.tags || [],
    creator_notes: char.creator_notes,
  }
}

export function toDeepDiveInput(
  char: CharacterDTO,
): Parameters<typeof buildDeepDiveMessages>[0] {
  return {
    ...toQuickOverviewInput(char),
    first_mes: char.first_mes,
    mes_example: char.mes_example,
    alternate_greetings: char.alternate_greetings || [],
  }
}

export function toTinderDescInput(
  char: CharacterDTO,
): Parameters<typeof buildTinderDescMessages>[0] {
  return {
    name: char.name,
    description: char.description,
    personality: char.personality,
    tags: char.tags || [],
  }
}

const GENERATORS: Record<
  WarmKind,
  {
    field: 'quickOverview' | 'deepDive' | 'tinderDesc'
    action: LlmAction
    build: (char: CharacterDTO) => Messages
  }
> = {
  quick: {
    field: 'quickOverview',
    action: 'quick',
    build: (c) => buildQuickOverviewMessages(toQuickOverviewInput(c)),
  },
  deep: {
    field: 'deepDive',
    action: 'deep',
    build: (c) => buildDeepDiveMessages(toDeepDiveInput(c)),
  },
  tinder: {
    field: 'tinderDesc',
    action: 'tinder',
    build: (c) => buildTinderDescMessages(toTinderDescInput(c)),
  },
}

export function messagesForKind(kind: WarmKind, char: CharacterDTO): Messages {
  return GENERATORS[kind].build(char)
}

async function generateCachedField(
  kind: WarmKind,
  characterId: string,
  force: boolean,
  userId?: string,
  known?: CharacterDTO,
): Promise<GenerateResult> {
  const spec = GENERATORS[kind]
  if (!force) {
    const hit = (await getCache(characterId))?.[spec.field]
    if (hit) return { text: hit, cached: true }
  }
  const char = known ?? (await getCharacter(characterId, userId))
  if (!char) ariFail('That character is gone.')
  const { content, model } = await quietGenerate(
    spec.build(char),
    spec.action,
    userId,
  )
  await setCache(characterId, { [spec.field]: content, modelUsed: model })
  return { text: content, cached: false }
}

export function generateQuickOverview(
  characterId: string,
  force = false,
  userId?: string,
  char?: CharacterDTO,
): Promise<GenerateResult> {
  return generateCachedField('quick', characterId, force, userId, char)
}

export function generateDeepDive(
  characterId: string,
  force = false,
  userId?: string,
  char?: CharacterDTO,
): Promise<GenerateResult> {
  return generateCachedField('deep', characterId, force, userId, char)
}

const tinderDescInFlight = new Map<string, Promise<GenerateResult>>()

export async function generateTinderDesc(
  characterId: string,
  force = false,
  userId?: string,
  char?: CharacterDTO,
): Promise<GenerateResult> {
  if (!force) {
    const hit = (await getCache(characterId))?.tinderDesc
    if (hit) return { text: hit, cached: true }
    const existing = tinderDescInFlight.get(characterId)
    if (existing) return existing
  }

  const run = generateCachedField('tinder', characterId, true, userId, char)

  if (!force) {
    tinderDescInFlight.set(characterId, run)
    void run
      .catch(() => {})
      .finally(() => {
        tinderDescInFlight.delete(characterId)
      })
  }
  return run
}

export async function generateRaw(
  messages: Array<{ role: string; content: string }>,
  userId?: string,
  action: LlmAction = 'search',
): Promise<string> {
  const { content } = await quietGenerate(messages, action, userId)
  return content
}
