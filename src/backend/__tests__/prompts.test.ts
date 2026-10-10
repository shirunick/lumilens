import { describe, expect, test } from 'bun:test'
import { ARI_SYSTEM_PROMPT, ariSystemMessage } from '../prompts/ari-system'
import { buildDeepDiveMessages } from '../prompts/deep-dive'
import {
  buildNlSearchMessages,
  parseNlSearchIds,
} from '../prompts/nl-search'
import { buildQuickOverviewMessages } from '../prompts/quick-overview'
import { buildTinderDescMessages } from '../prompts/tinder-desc'

describe('prompts', () => {
  test('ari system is first person deadpan guidance', () => {
    expect(ARI_SYSTEM_PROMPT).toContain('You are Ari')
    expect(ARI_SYSTEM_PROMPT).toContain('Never use exclamation marks')
    expect(ariSystemMessage().role).toBe('system')
  })

  test('quick overview includes character fields', () => {
    const msgs = buildQuickOverviewMessages({
      name: 'Ada',
      description: 'desc',
      personality: 'kind',
      scenario: 'lab',
      tags: ['Sci-Fi'],
      creator_notes: 'notes',
    })
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('Ada')
    expect(msgs[1].content).toContain('Sci-Fi')
  })

  test('deep dive lists required sections', () => {
    const msgs = buildDeepDiveMessages({
      name: 'Ada',
      description: 'd',
      personality: 'p',
      scenario: 's',
      first_mes: 'hi',
      mes_example: 'ex',
      tags: ['t'],
      creator_notes: 'n',
      alternate_greetings: ['alt'],
    })
    expect(msgs[1].content).toContain('User Persona')
    expect(msgs[1].content).toContain('no definition')
    expect(msgs[1].content).toContain('Personality Breakdown')
    expect(msgs[1].content).toContain('Scenario Hooks')
    expect(msgs[1].content).toContain('RP Potential')
    expect(msgs[1].content).toContain('Tag Analysis')
    expect(msgs[1].content).toContain('Notable Features')
    expect(msgs[1].content).toContain('alt')
  })

  test('tinder desc forbids hashtags emoji', () => {
    const msgs = buildTinderDescMessages({
      name: 'Ada',
      description: 'd',
      personality: 'p',
      tags: ['t'],
    })
    expect(msgs[1].content).toContain('No hashtags')
    expect(msgs[1].content).toContain('No emoji')
  })

  test('nl search parse accepts raw array', () => {
    const pool = new Set(['a', 'b', 'c'])
    expect(parseNlSearchIds('["b","a"]', pool)).toEqual(['b', 'a'])
  })

  test('nl search parse strips fences and filters unknown', () => {
    const pool = new Set(['a', 'b'])
    expect(
      parseNlSearchIds('```json\n["a","x","b"]\n```', pool),
    ).toEqual(['a', 'b'])
  })

  test('nl search parse returns null on garbage', () => {
    expect(parseNlSearchIds('not json', new Set(['a']))).toBeNull()
    expect(parseNlSearchIds('{}', new Set(['a']))).toBeNull()
  })

  test('nl search messages list candidates', () => {
    const msgs = buildNlSearchMessages({
      query: 'vampire',
      candidates: [
        {
          id: '1',
          name: 'Vamp',
          tags: ['Horror'],
          shortDescription: 'dark',
        },
      ],
    })
    expect(msgs[1].content).toContain('vampire')
    expect(msgs[1].content).toContain('Vamp')
  })
})
