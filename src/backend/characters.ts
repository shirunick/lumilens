import { CHARACTER_PAGE_SIZE } from '../shared/constants'
import type { CharacterSummary } from '../shared/types'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

const LIBRARY_TTL_MS = 5000
const SHORT_DESC_MAX = 280

export type CharacterDTO = {
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

export async function listAllCharacters(
  userId?: string,
): Promise<CharacterDTO[]> {
  const all: CharacterDTO[] = []
  let offset = 0
  let total = Infinity

  while (offset < total) {
    const page = await spindle.characters.list({
      limit: CHARACTER_PAGE_SIZE,
      offset,
      ...(userId ? { userId } : {}),
    })
    const rows = Array.isArray(page?.data) ? page.data : []
    total = Math.max(0, Number(page?.total) || 0)
    for (const row of rows) {
      all.push(row as CharacterDTO)
    }
    offset += rows.length
    if (rows.length === 0) break
  }

  return all
}

const libraryMemo = new Map<
  string,
  { at: number; promise: Promise<CharacterDTO[]> }
>()

export function getLibrary(userId?: string): Promise<CharacterDTO[]> {
  const key = userId || ''
  const hit = libraryMemo.get(key)
  if (hit && Date.now() - hit.at < LIBRARY_TTL_MS) return hit.promise
  const promise = listAllCharacters(userId)
  libraryMemo.set(key, { at: Date.now(), promise })
  promise.catch(() => {
    if (libraryMemo.get(key)?.promise === promise) libraryMemo.delete(key)
  })
  return promise
}

export function invalidateLibrary(): void {
  libraryMemo.clear()
}

export async function getCharacter(
  characterId: string,
  userId?: string,
): Promise<CharacterDTO | null> {
  const char = await spindle.characters.get(characterId, userId)
  return (char as CharacterDTO | null) ?? null
}

export async function deleteCharacter(
  characterId: string,
  userId?: string,
): Promise<boolean> {
  const deleted = await spindle.characters.delete(characterId, userId)
  invalidateLibrary()
  return deleted
}

export async function resolveImageUrl(
  imageId: string | null | undefined,
  userId?: string,
): Promise<string | null> {
  if (!imageId) return null
  try {
    const image = await spindle.images.get(imageId, {
      specificity: 'sm',
      ...(userId ? { userId } : {}),
    })
    if (!image || typeof image !== 'object') return null
    const url = (image as { url?: string }).url
    return typeof url === 'string' && url.length > 0 ? url : null
  } catch {
    return null
  }
}

export async function toSummary(
  char: CharacterDTO,
  includeExtended = false,
  userId?: string,
): Promise<CharacterSummary> {
  const imageUrl = await resolveImageUrl(char.image_id, userId)
  const base: CharacterSummary = {
    id: char.id,
    name: char.name || 'Unnamed',
    description: char.description || '',
    tags: Array.isArray(char.tags) ? char.tags : [],
    creator: char.creator || '',
    creator_notes: char.creator_notes || '',
    image_id: char.image_id ?? null,
    imageUrl,
  }
  if (includeExtended) {
    base.personality = char.personality || ''
    base.scenario = char.scenario || ''
    base.first_mes = char.first_mes || ''
    base.mes_example = char.mes_example || ''
    base.alternate_greetings = Array.isArray(char.alternate_greetings)
      ? char.alternate_greetings
      : []
  }
  return base
}

export function shortDescription(char: {
  description?: string
  personality?: string
}): string {
  const d = String(char.description || '').trim()
  if (d) return d.slice(0, SHORT_DESC_MAX)
  const p = String(char.personality || '').trim()
  return p.slice(0, SHORT_DESC_MAX)
}

export async function findCharacterByName(
  name: string,
  userId?: string,
): Promise<CharacterDTO | null> {
  const needle = name
    .trim()
    .replace(/(\u2026|\.{3})$/, '')
    .trim()
    .toLowerCase()
  if (!needle) return null
  const all = await getLibrary(userId)
  const lower = (c: CharacterDTO) => c.name.trim().toLowerCase()
  return (
    all.find((c) => lower(c) === needle) ??
    all.find((c) => lower(c).startsWith(needle)) ??
    all.find((c) => lower(c).includes(needle)) ??
    null
  )
}

export async function resolveCharacter(
  candidateIds: string[],
  name: string | undefined,
  userId?: string,
): Promise<CharacterDTO | null> {
  for (const id of candidateIds) {
    try {
      const char = await getCharacter(id, userId)
      if (char) return char
    } catch {
      continue
    }
  }
  return name ? findCharacterByName(name, userId) : null
}
