import {
  NL_POOL_TARGET,
  PICKER_RESULT_COUNT,
  NL_RANDOM_FALLBACKS,
  STOPWORDS,
} from '../shared/constants'
import type { CharacterSummary } from '../shared/types'
import { getLibrary, shortDescription, toSummary } from './characters'
import { generateRaw } from './generate'
import { shuffle } from './util'
import {
  buildNlSearchMessages,
  parseNlSearchIds,
} from './prompts/nl-search'

function normalizeTag(t: string): string {
  return t.trim().toLowerCase()
}

export function filterByTags<T extends { tags: string[] }>(
  cards: T[],
  selectedTags: string[],
): T[] {
  if (!selectedTags.length) return cards
  const need = selectedTags.map(normalizeTag)
  return cards.filter((c) => {
    const have = new Set((c.tags || []).map(normalizeTag))
    return need.every((t) => have.has(t))
  })
}

export function extractKeywords(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

export function scoreCard(
  card: { name: string; description: string; tags: string[]; personality?: string },
  keywords: string[],
): number {
  if (!keywords.length) return 0
  const bag = [
    card.name,
    card.description,
    card.personality || '',
    ...(card.tags || []),
  ]
    .join(' ')
    .toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (bag.includes(kw)) score += 1
    if ((card.tags || []).some((t) => normalizeTag(t).includes(kw))) score += 2
    if (card.name.toLowerCase().includes(kw)) score += 2
  }
  return score
}

export function buildCandidatePool<
  T extends { id: string; name: string; description: string; tags: string[] },
>(
  cards: T[],
  query: string,
  excludeIds: string[] = [],
): T[] {
  const exclude = new Set(excludeIds)
  const available = cards.filter((c) => !exclude.has(c.id))
  if (!available.length) return []

  const keywords = extractKeywords(query)
  if (!keywords.length) {
    return shuffle([...available]).slice(0, NL_POOL_TARGET)
  }

  const scored = available
    .map((c) => ({ c, score: scoreCard(c, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: T[] = scored.slice(0, NL_POOL_TARGET).map((x) => x.c)
  const pickedIds = new Set(picked.map((c) => c.id))

  const leftovers = available.filter((c) => !pickedIds.has(c.id))
  const fallbacks = shuffle(leftovers).slice(0, NL_RANDOM_FALLBACKS)
  return [...picked, ...fallbacks]
}

export async function surpriseCharacter(
  userId?: string,
): Promise<CharacterSummary | null> {
  const all = await getLibrary(userId)
  if (!all.length) return null
  const pick = all[Math.floor(Math.random() * all.length)]
  return toSummary(pick, false, userId)
}

export async function findCards(opts: {
  tags: string[]
  query: string
  excludeIds?: string[]
  userId?: string
}): Promise<{ characters: CharacterSummary[]; usedLlm: boolean }> {
  const all = await getLibrary(opts.userId)
  const tags = opts.tags || []
  const exclude = new Set(opts.excludeIds || [])
  const available = all.filter((c) => !exclude.has(c.id))
  const strict = filterByTags(available, tags)
  const pool = tags.length > 0 && strict.length === 0 ? available : strict

  const typed = String(opts.query || '').trim()
  const keywordText = [typed, ...tags].join(' ').trim()
  const llmQuery = typed
    ? tags.length > 0
      ? `${typed} (categories: ${tags.join(', ')})`
      : typed
    : tags.length > 0
      ? `Cards that fit these categories: ${tags.join(', ')}`
      : ''

  const summarize = (cards: typeof all) =>
    Promise.all(
      cards
        .slice(0, PICKER_RESULT_COUNT)
        .map((c) => toSummary(c, false, opts.userId)),
    )

  if (!llmQuery) {
    return { characters: await summarize(shuffle(pool)), usedLlm: false }
  }

  const candidates = buildCandidatePool(pool, keywordText, [])
  if (!candidates.length) {
    return { characters: [], usedLlm: false }
  }

  const keywords = extractKeywords(keywordText)
  const keywordOrder = [...candidates].sort(
    (a, b) => scoreCard(b, keywords) - scoreCard(a, keywords),
  )

  let ordered = keywordOrder
  let usedLlm = false

  try {
    const messages = buildNlSearchMessages({
      query: llmQuery,
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        tags: c.tags || [],
        shortDescription: shortDescription(c),
      })),
    })
    const raw = await generateRaw(messages, opts.userId, 'search')
    const poolIds = new Set(candidates.map((c) => c.id))
    const parsed = parseNlSearchIds(raw, poolIds)
    if (parsed) {
      const byId = new Map(candidates.map((c) => [c.id, c]))
      ordered = parsed
        .map((id) => byId.get(id))
        .filter((c): c is (typeof candidates)[number] => !!c)
      for (const c of keywordOrder) {
        if (!parsed.includes(c.id)) ordered.push(c)
      }
      usedLlm = true
    }
  } catch {
    usedLlm = false
  }

  return { characters: await summarize(ordered), usedLlm }
}
