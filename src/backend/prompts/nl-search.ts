import { ariSystemMessage } from './ari-system'

export interface NlSearchCandidate {
  id: string
  name: string
  tags: string[]
  shortDescription: string
}

export interface NlSearchInput {
  query: string
  candidates: NlSearchCandidate[]
}

export function buildNlSearchMessages(input: NlSearchInput) {
  const pool = input.candidates
    .map(
      (c) =>
        `- id: ${c.id} | name: ${c.name} | tags: ${c.tags.join(', ') || '(none)'} | desc: ${c.shortDescription || '(none)'}`,
    )
    .join('\n')

  const user = `The user wants: "${input.query}"

Rank these candidate character cards from best match to worst.
Return ONLY a JSON array of character id strings, e.g. ["id1","id2"].
Include only ids from the list. No commentary. No markdown fences if you can avoid them.

Candidates:
${pool}`

  return [ariSystemMessage(), { role: 'user' as const, content: user }]
}

export function parseNlSearchIds(
  raw: string,
  poolIds: Set<string>,
): string[] | null {
  const text = String(raw || '').trim()
  if (!text) return null

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : text).trim()

  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start < 0 || end <= start) return null

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    if (!Array.isArray(parsed)) return null
    const ids = parsed
      .map((x) => String(x))
      .filter((id) => poolIds.has(id))

    const seen = new Set<string>()
    const out: string[] = []
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}
