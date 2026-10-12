import { CACHE_PATH } from '../shared/constants'
import { EMPTY_CACHE, type CacheEntry, type WarmKind } from '../shared/types'
import { getLibrary } from './characters'
import { mapLimit } from './util'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

const CLEAR_CONCURRENCY = 8
const writeLocks = new Map<string, Promise<void>>()

const FIELD_BY_KIND: Record<WarmKind, keyof Pick<CacheEntry, 'quickOverview' | 'deepDive' | 'tinderDesc'>> = {
  quick: 'quickOverview',
  deep: 'deepDive',
  tinder: 'tinderDesc',
}

export async function getCache(characterId: string): Promise<CacheEntry | null> {
  try {
    const entry = await spindle.storage.getJson<CacheEntry | null>(
      CACHE_PATH(characterId),
      { fallback: null },
    )
    if (!entry || typeof entry !== 'object') return null
    return {
      quickOverview:
        typeof entry.quickOverview === 'string' ? entry.quickOverview : null,
      deepDive: typeof entry.deepDive === 'string' ? entry.deepDive : null,
      tinderDesc: typeof entry.tinderDesc === 'string' ? entry.tinderDesc : null,
      generatedAt:
        typeof entry.generatedAt === 'number' ? entry.generatedAt : 0,
      modelUsed: typeof entry.modelUsed === 'string' ? entry.modelUsed : null,
    }
  } catch {
    return null
  }
}

export async function setCache(
  characterId: string,
  patch: Partial<CacheEntry>,
): Promise<CacheEntry> {
  const prev = writeLocks.get(characterId) ?? Promise.resolve()
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = prev.then(() => held)
  writeLocks.set(characterId, tail)
  await prev
  try {
    const existing = (await getCache(characterId)) ?? { ...EMPTY_CACHE }
    const next: CacheEntry = {
      ...existing,
      ...patch,
      generatedAt: Date.now(),
    }
    await spindle.storage.setJson(CACHE_PATH(characterId), next)
    return next
  } finally {
    release()
    if (writeLocks.get(characterId) === tail) writeLocks.delete(characterId)
  }
}

export async function getOrEmpty(characterId: string): Promise<CacheEntry> {
  return (await getCache(characterId)) ?? { ...EMPTY_CACHE }
}

export async function deleteCache(characterId: string): Promise<boolean> {
  const path = CACHE_PATH(characterId)
  const prev = writeLocks.get(characterId) ?? Promise.resolve()
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = prev.then(() => held)
  writeLocks.set(characterId, tail)
  await prev
  try {
    const existing = await getCache(characterId)
    if (!existing) return false
    await spindle.storage.delete(path)
    return true
  } catch {
    return false
  } finally {
    release()
    if (writeLocks.get(characterId) === tail) writeLocks.delete(characterId)
  }
}

export async function clearCachedKind(
  kind: WarmKind,
  userId?: string,
): Promise<number> {
  const field = FIELD_BY_KIND[kind]
  const all = await getLibrary(userId)
  const results = await mapLimit(all, CLEAR_CONCURRENCY, async (c) => {
    const cache = await getCache(c.id)
    if (!cache?.[field]) return false
    await setCache(c.id, { [field]: null })
    return true
  })
  return results.filter(Boolean).length
}
