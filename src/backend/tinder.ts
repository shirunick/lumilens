import { STORAGE, TINDER_BIO_PREFETCH } from '../shared/constants'
import {
  emptyTinderQueue,
  type TinderAction,
  type TinderCardView,
  type TinderMode,
  type TinderProgress,
  type TinderQueue,
} from '../shared/types'
import {
  deleteCharacter,
  getCharacter,
  getLibrary,
  toSummary,
} from './characters'
import { getCache } from './cache'
import { generateTinderDesc } from './generate'
import { getSettings } from './settings'
import { shuffle } from './util'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

function queuePath(mode: TinderMode): string {
  return mode === 'out' ? STORAGE.tinderOut : STORAGE.tinderChat
}

export async function loadQueue(mode: TinderMode): Promise<TinderQueue> {
  try {
    const raw = await spindle.storage.getJson<TinderQueue | null>(
      queuePath(mode),
      { fallback: null },
    )
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.remainingIds)) {
      return emptyTinderQueue(mode)
    }
    return {
      mode,
      remainingIds: raw.remainingIds.map(String),
      history: Array.isArray(raw.history) ? raw.history : [],
      kept: Number(raw.kept) || 0,
      deleted: Number(raw.deleted) || 0,
      declined: Number(raw.declined) || 0,
      accepted: Number(raw.accepted) || 0,
    }
  } catch {
    return emptyTinderQueue(mode)
  }
}

export async function saveQueue(queue: TinderQueue): Promise<void> {
  await spindle.storage.setJson(queuePath(queue.mode), queue)
}

function progress(queue: TinderQueue): TinderProgress {
  const done =
    queue.kept + queue.deleted + queue.declined + queue.accepted
  const remaining = queue.remainingIds.length
  const total = done + remaining
  return {
    current: remaining === 0 ? total : done + 1,
    total,
    kept: queue.kept,
    deleted: queue.deleted,
    declined: queue.declined,
    accepted: queue.accepted,
    remaining,
  }
}

async function cardFromQueue(
  queue: TinderQueue,
  userId?: string,
): Promise<TinderCardView | null> {
  while (queue.remainingIds.length > 0) {
    const id = queue.remainingIds[0]
    const char = await getCharacter(id, userId)
    if (!char) {
      queue.remainingIds.shift()
      await saveQueue(queue)
      continue
    }
    const [summary, cache] = await Promise.all([
      toSummary(char, false, userId),
      getCache(id),
    ])
    return {
      character: summary,
      tinderDesc: cache?.tinderDesc ?? null,
      progress: progress(queue),
    }
  }
  return null
}

const bioInFlight = new Map<string, Promise<string>>()

function requestBio(id: string, userId?: string): Promise<string> {
  const existing = bioInFlight.get(id)
  if (existing) return existing
  const p = generateTinderDesc(id, false, userId).then((r) => r.text)
  bioInFlight.set(id, p)
  void p
    .catch(() => {})
    .finally(() => {
      if (bioInFlight.get(id) === p) bioInFlight.delete(id)
    })
  return p
}

function prefetchBio(queue: TinderQueue, offset: number, userId?: string): void {
  const id = queue.remainingIds[offset]
  if (!id) return
  void getCache(id)
    .then((cache) => {
      if (cache?.tinderDesc) return
      return requestBio(id, userId)
    })
    .catch(() => {})
}

function prefetchAhead(queue: TinderQueue, userId?: string): void {
  for (let i = 1; i <= TINDER_BIO_PREFETCH; i++) {
    prefetchBio(queue, i, userId)
  }
}

export async function settleTinderPrefetch(): Promise<void> {
  await Promise.allSettled([...bioInFlight.values()])
}

function kickoffBio(
  card: TinderCardView,
  queue: TinderQueue,
  userId?: string,
): void {
  prefetchAhead(queue, userId)
  if (!card.tinderDesc) {
    void requestBio(card.character.id, userId).catch(() => {})
  }
}

export async function initTinder(
  mode: TinderMode,
  userId?: string,
): Promise<{ card: TinderCardView | null; empty: boolean; queue: TinderQueue }> {
  let queue = await loadQueue(mode)

  if (queue.remainingIds.length === 0 && queue.history.length === 0) {
    const all = await getLibrary(userId)
    queue = {
      ...emptyTinderQueue(mode),
      remainingIds: shuffle(all.map((c) => c.id)),
    }
    await saveQueue(queue)
  }

  const card = await cardFromQueue(queue, userId)
  if (card) kickoffBio(card, queue, userId)

  return {
    card,
    empty: !card,
    queue,
  }
}

export async function swipeTinder(
  mode: TinderMode,
  direction: 'left' | 'right',
  userId?: string,
): Promise<{
  card: TinderCardView | null
  empty: boolean
  action: TinderAction | 'none'
}> {
  const queue = await loadQueue(mode)
  if (queue.remainingIds.length === 0) {
    return { card: null, empty: true, action: 'none' }
  }

  const id = queue.remainingIds[0]
  let action: TinderAction

  if (mode === 'out') {
    if (direction === 'right') {
      action = 'keep'
      queue.kept += 1
    } else {
      const settings = await getSettings()
      if (settings.testingMode) {
        action = 'delete_mock'
        spindle.log.info(
          `[LumiLens testingMode] Would delete character ${id}`,
        )
      } else {
        await deleteCharacter(id, userId)
        action = 'delete'
      }
      queue.deleted += 1
    }
  } else {
    if (direction === 'right') {
      action = 'accept'
      queue.accepted += 1
    } else {
      action = 'decline'
      queue.declined += 1
    }
  }

  queue.remainingIds.shift()
  queue.history.push({ id, action })
  await saveQueue(queue)

  const next = await cardFromQueue(queue, userId)
  if (next) kickoffBio(next, queue, userId)

  return { card: next, empty: !next, action }
}

export async function undoTinder(
  mode: TinderMode,
  userId?: string,
): Promise<{ card: TinderCardView | null; empty: boolean }> {
  const queue = await loadQueue(mode)
  const last = queue.history.pop()
  if (!last) {
    const card = await cardFromQueue(queue, userId)
    if (card) kickoffBio(card, queue, userId)
    return { card, empty: !card }
  }

  queue.remainingIds.unshift(last.id)
  switch (last.action) {
    case 'keep':
      queue.kept = Math.max(0, queue.kept - 1)
      break
    case 'delete':
    case 'delete_mock':
      queue.deleted = Math.max(0, queue.deleted - 1)
      break
    case 'accept':
      queue.accepted = Math.max(0, queue.accepted - 1)
      break
    case 'decline':
      queue.declined = Math.max(0, queue.declined - 1)
      break
  }
  await saveQueue(queue)
  const card = await cardFromQueue(queue, userId)
  if (card) kickoffBio(card, queue, userId)
  return { card, empty: !card }
}

export async function reshuffleTinder(
  mode: TinderMode,
  userId?: string,
): Promise<{ card: TinderCardView | null; empty: boolean }> {
  const all = await getLibrary(userId)
  const queue: TinderQueue = {
    ...emptyTinderQueue(mode),
    remainingIds: shuffle(all.map((c) => c.id)),
  }
  await saveQueue(queue)
  const card = await cardFromQueue(queue, userId)
  if (card) kickoffBio(card, queue, userId)
  return { card, empty: !card }
}

let activeMode: TinderMode = 'out'

export function setActiveTinderMode(mode: TinderMode): void {
  activeMode = mode
}

export function getActiveTinderMode(): TinderMode {
  return activeMode
}
