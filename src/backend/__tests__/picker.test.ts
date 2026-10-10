import { beforeEach, describe, expect, test } from 'bun:test'
import {
  buildCandidatePool,
  extractKeywords,
  filterByTags,
  findCards,
  scoreCard,
  surpriseCharacter,
} from '../picker'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('picker', () => {
  beforeEach(() => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: '["c1","c3"]',
      }),
    )
  })

  test('filterByTags requires all selected tags', () => {
    const cards = sampleCharacters()
    const both = filterByTags(cards, ['Horror', 'Fantasy'])
    expect(both.map((c) => c.id)).toEqual(['c1'])
    expect(filterByTags(cards, []).length).toBe(3)
  })

  test('extractKeywords drops stopwords', () => {
    expect(extractKeywords('a brooding vampire with redemption')).toContain(
      'vampire',
    )
    expect(extractKeywords('a brooding vampire with redemption')).not.toContain(
      'with',
    )
  })

  test('scoreCard prefers tag and name hits', () => {
    const c = sampleCharacters()[0]
    expect(scoreCard(c, ['vampire'])).toBeGreaterThan(0)
  })

  test('buildCandidatePool returns bounded size', () => {
    const cards = sampleCharacters()
    const pool = buildCandidatePool(cards, 'vampire horror', [])
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.length).toBeLessThanOrEqual(21)
  })

  test('surprise returns a character', async () => {
    const c = await surpriseCharacter()
    expect(c?.id).toBeTruthy()
  })

  test('findCards tags-only still ranks with the LLM', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: '["c2"]',
      }),
    )
    const r = await findCards({ tags: ['Sci-Fi'], query: '' })
    expect(r.usedLlm).toBe(true)
    expect(r.characters.map((c) => c.id)).toEqual(['c2'])
  })

  test('findCards tags with no strict match falls back to whole library', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: '["c3"]',
      }),
    )
    const r = await findCards({ tags: ['Cozy'], query: '' })
    expect(r.usedLlm).toBe(true)
    expect(r.characters[0]?.id).toBe('c3')
  })

  test('findCards without tags or query shuffles and limits', async () => {
    const r = await findCards({ tags: [], query: '' })
    expect(r.usedLlm).toBe(false)
    expect(r.characters.length).toBeLessThanOrEqual(4)
  })

  test('findCards combines typed query with categories', async () => {
    let seen = ''
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: (messages) => {
          seen = JSON.stringify(messages)
          return '["c1"]'
        },
      }),
    )
    await findCards({ tags: ['Horror'], query: 'vampire' })
    expect(seen).toContain('categories: Horror')
  })

  test('findCards NL uses LLM ranking', async () => {
    const r = await findCards({
      tags: [],
      query: 'brooding vampire redemption',
    })
    expect(r.usedLlm).toBe(true)
    expect(r.characters[0]?.id).toBe('c1')
  })

  test('findCards malformed JSON falls back', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'not-json-at-all',
      }),
    )
    const r = await findCards({
      tags: [],
      query: 'vampire',
    })
    expect(r.usedLlm).toBe(false)
    expect(r.characters.length).toBeGreaterThan(0)
  })

  test('findCards excludeIds', async () => {
    const r = await findCards({
      tags: [],
      query: '',
      excludeIds: ['c1', 'c2'],
    })
    expect(r.characters.every((c) => c.id === 'c3')).toBe(true)
  })

  test('AND tags then NL', async () => {
    const r = await findCards({
      tags: ['Horror'],
      query: 'vampire',
    })
    expect(r.characters.every((c) => c.tags.map((t) => t.toLowerCase()).includes('horror'))).toBe(
      true,
    )
  })
})
