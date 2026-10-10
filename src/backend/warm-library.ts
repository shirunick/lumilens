import { getCache } from './cache'
import { getLibrary, type CharacterDTO } from './characters'
import {
  generateDeepDive,
  generateQuickOverview,
  generateTinderDesc,
  messagesForKind,
} from './generate'
import { mapLimit } from './util'
import type { WarmKind } from '../shared/types'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

const CONCURRENCY = 2
const CACHE_READ_CONCURRENCY = 8
const ESTIMATE_REUSE_MS = 30_000

const RUNNERS: Record<
  WarmKind,
  (id: string, force: boolean, userId?: string, char?: CharacterDTO) => Promise<unknown>
> = {
  quick: generateQuickOverview,
  deep: generateDeepDive,
  tinder: generateTinderDesc,
}

export type WarmBreakdown = {
  quick: number
  deep: number
  tinder: number
}

export type WarmEstimate = {
  jobs: number
  cards: number
  inputTokensApprox: number
  breakdown: WarmBreakdown
}

type WarmTask = {
  characterId: string
  name: string
  kind: WarmKind
  char: CharacterDTO
}

type Collected = { tasks: WarmTask[]; estimate: WarmEstimate }

let lastCollected: { key: string; at: number; result: Collected } | null = null

function collectKey(kinds: WarmKind[], userId?: string): string {
  return `${userId || ''}|${[...kinds].sort().join(',')}`
}

type WarmRun = {
  cancelled: boolean
  done: number
  failed: number
  total: number
  userId?: string
  promise: Promise<void>
}

let active: WarmRun | null = null

export function normalizeWarmKinds(kinds: unknown): WarmKind[] {
  const allowed = new Set<WarmKind>(['quick', 'deep', 'tinder'])
  const out: WarmKind[] = []
  const seen = new Set<WarmKind>()
  if (!Array.isArray(kinds)) return out
  for (const k of kinds) {
    if (typeof k !== 'string') continue
    if (!allowed.has(k as WarmKind)) continue
    const kind = k as WarmKind
    if (seen.has(kind)) continue
    seen.add(kind)
    out.push(kind)
  }
  return out
}

function estimateTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  let chars = 0
  for (const m of messages) chars += m.content.length
  return Math.ceil(chars / 4)
}

function missingKinds(
  kindList: WarmKind[],
  cache: Awaited<ReturnType<typeof getCache>>,
): WarmKind[] {
  const missing: WarmKind[] = []
  for (const kind of kindList) {
    if (kind === 'quick' && !cache?.quickOverview) missing.push(kind)
    else if (kind === 'deep' && !cache?.deepDive) missing.push(kind)
    else if (kind === 'tinder' && !cache?.tinderDesc) missing.push(kind)
  }
  return missing
}

async function collectTasks(
  kinds: WarmKind[],
  userId?: string,
): Promise<Collected> {
  const all = await getLibrary(userId)
  const caches = await mapLimit(all, CACHE_READ_CONCURRENCY, (c) =>
    getCache(c.id),
  )
  const tasks: WarmTask[] = []
  const breakdown: WarmBreakdown = { quick: 0, deep: 0, tinder: 0 }
  let inputTokensApprox = 0
  const cardIds = new Set<string>()

  all.forEach((char, i) => {
    const need = missingKinds(kinds, caches[i])
    if (need.length === 0) return
    cardIds.add(char.id)
    for (const kind of need) {
      tasks.push({ characterId: char.id, name: char.name, kind, char })
      breakdown[kind] += 1
      inputTokensApprox += estimateTokens(messagesForKind(kind, char))
    }
  })

  const result: Collected = {
    tasks,
    estimate: {
      jobs: tasks.length,
      cards: cardIds.size,
      inputTokensApprox,
      breakdown,
    },
  }
  lastCollected = { key: collectKey(kinds, userId), at: Date.now(), result }
  return result
}

export function resetWarmEstimate(): void {
  lastCollected = null
}

function takeRecentCollected(
  kinds: WarmKind[],
  userId?: string,
): Collected | null {
  const hit = lastCollected
  lastCollected = null
  if (!hit) return null
  if (hit.key !== collectKey(kinds, userId)) return null
  if (Date.now() - hit.at > ESTIMATE_REUSE_MS) return null
  return hit.result
}

export async function estimateWarmLibrary(
  kinds: WarmKind[],
  userId?: string,
): Promise<WarmEstimate> {
  if (kinds.length === 0) {
    return {
      jobs: 0,
      cards: 0,
      inputTokensApprox: 0,
      breakdown: { quick: 0, deep: 0, tinder: 0 },
    }
  }
  const { estimate } = await collectTasks(kinds, userId)
  return estimate
}

function pushProgress(
  run: WarmRun,
  currentName: string | null,
): void {
  spindle.sendToFrontend(
    {
      type: 'warm_library_progress',
      done: run.done,
      total: run.total,
      failed: run.failed,
      currentName,
    },
    run.userId,
  )
}

function pushDone(run: WarmRun): void {
  spindle.sendToFrontend(
    {
      type: 'warm_library_done',
      done: run.done,
      total: run.total,
      failed: run.failed,
      cancelled: run.cancelled,
    },
    run.userId,
  )
}

async function runTask(task: WarmTask, userId?: string): Promise<void> {
  await RUNNERS[task.kind](task.characterId, false, userId, task.char)
}

async function executeWarm(
  run: WarmRun,
  tasks: WarmTask[],
): Promise<void> {
  const queue = [...tasks]
  pushProgress(run, null)

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      if (run.cancelled) return
      const task = queue.shift()
      if (!task) return
      pushProgress(run, task.name)
      try {
        await runTask(task, run.userId)
      } catch {
        run.failed += 1
      }
      run.done += 1
      pushProgress(run, null)
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(1, tasks.length)) },
    () => worker(),
  )
  await Promise.all(workers)
  pushDone(run)
  if (active === run) active = null
}

export function isWarmLibraryRunning(): boolean {
  return active !== null
}

export async function startWarmLibrary(
  kinds: WarmKind[],
  userId?: string,
): Promise<{ total: number }> {
  if (active) {
    throw new Error('A library warm is already running.')
  }
  if (kinds.length === 0) {
    throw new Error('Pick at least one kind to generate.')
  }

  const { tasks, estimate } =
    takeRecentCollected(kinds, userId) ?? (await collectTasks(kinds, userId))
  if (tasks.length === 0) {
    const empty: WarmRun = {
      cancelled: false,
      done: 0,
      failed: 0,
      total: 0,
      userId,
      promise: Promise.resolve(),
    }
    spindle.sendToFrontend(
      {
        type: 'warm_library_done',
        done: 0,
        total: 0,
        failed: 0,
        cancelled: false,
      },
      userId,
    )
    return { total: estimate.jobs }
  }

  const run: WarmRun = {
    cancelled: false,
    done: 0,
    failed: 0,
    total: tasks.length,
    userId,
    promise: Promise.resolve(),
  }
  active = run
  run.promise = executeWarm(run, tasks)
  return { total: run.total }
}

export function cancelWarmLibrary(): { cancelled: boolean } {
  if (!active) return { cancelled: false }
  active.cancelled = true
  return { cancelled: true }
}

export async function settleWarmLibrary(): Promise<void> {
  if (active) await active.promise
}
