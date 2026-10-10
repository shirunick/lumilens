import { beforeEach, describe, expect, test } from 'bun:test'
import {
  findCharacterByName,
  resolveCharacter,
} from '../characters'
import { generateQuickOverview, stripDashes } from '../generate'
import { ARI_SYSTEM_PROMPT } from '../prompts/ari-system'
import { buildQuickOverviewMessages } from '../prompts/quick-overview'
import { buildTinderDescMessages } from '../prompts/tinder-desc'
import { handleFrontendMessage } from '../rpc'
import { initTinder, settleTinderPrefetch, swipeTinder } from '../tinder'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('voice rules', () => {
  test('stripDashes removes em dashes and spaced en dashes only', () => {
    expect(stripDashes('One \u2014 two\u2014three')).toBe('One, two, three')
    expect(stripDashes('Range 3\u20135 and a \u2013 b')).toBe(
      'Range 3\u20135 and a, b',
    )
  })

  test('generated text never keeps em dashes', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'You are a mortal \u2014 and he is not.',
      }),
    )
    const r = await generateQuickOverview('c1', true)
    expect(r.text).toBe('You are a mortal, and he is not.')
  })

  test('system prompt forbids dashes and in-character voice', () => {
    expect(ARI_SYSTEM_PROMPT).toContain('Never use em dashes')
    expect(ARI_SYSTEM_PROMPT).toContain('never the character')
  })

  test('quick pitch asks for the user role', () => {
    const [, user] = buildQuickOverviewMessages({
      name: 'X',
      description: '',
      personality: '',
      scenario: '',
      first_mes: 'Hello',
      tags: [],
      creator_notes: '',
    })
    expect(user.content).toContain('who YOU, the user, are cast as')
    expect(user.content).toContain('You are')
    expect(user.content).toContain('You play')
    expect(user.content).toContain('does not define who you are')
    expect(user.content).toContain('Do not invent')
    expect(user.content).toContain('First message: Hello')
  })

  test('tinder blurb is third person as Ari', () => {
    const [, user] = buildTinderDescMessages({
      name: 'X',
      description: '',
      personality: '',
      tags: [],
    })
    expect(user.content).toContain('You are Ari, not the character')
  })
})

describe('character resolution', () => {
  beforeEach(() => {
    installSpindleMock(createSpindleMock({ characters: sampleCharacters() }))
  })

  test('name lookup tolerates truncation and partial names', async () => {
    expect((await findCharacterByName('Vampire Lord'))?.id).toBe('c1')
    expect((await findCharacterByName('Space Ca\u2026'))?.id).toBe('c2')
    expect((await findCharacterByName('Space Ca...'))?.id).toBe('c2')
    expect((await findCharacterByName('ghost'))?.id).toBe('c3')
    expect(await findCharacterByName('Nobody Here')).toBeNull()
    expect(await findCharacterByName('   ')).toBeNull()
  })

  test('resolveCharacter prefers a valid id then falls back to name', async () => {
    expect((await resolveCharacter(['bogus', 'c2'], 'Vampire Lord'))?.id).toBe(
      'c2',
    )
    expect((await resolveCharacter(['bogus'], 'Vampire Lord'))?.id).toBe('c1')
    expect(await resolveCharacter(['bogus'], undefined)).toBeNull()
  })

  test('resolveCharacter skips ids that throw', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    const original = api.characters.get
    api.characters.get = async (id: string) => {
      if (id === 'boom') throw new Error('nope')
      return original(id)
    }
    expect((await resolveCharacter(['boom', 'c3'], undefined))?.id).toBe('c3')
  })

  test('rpc resolves a card from candidate ids', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    await handleFrontendMessage(
      {
        type: 'resolve_character_by_name',
        requestId: 'r1',
        candidateIds: ['image-id', 'c1'],
        name: 'whatever',
      },
      'u1',
    )
    expect(api.__frontendMessages.at(-1)).toMatchObject({
      type: 'resolve_character_by_name_result',
      character: { id: 'c1' },
    })
  })
})

describe('tinder prefetch', () => {
  test('next card bio is prepared while the current one loads', async () => {
    const calls: string[] = []
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: (messages) => {
          calls.push(JSON.stringify(messages))
          return 'A blurb about them.'
        },
      }),
    )
    const first = await initTinder('chat')
    expect(first.card?.tinderDesc).toBeNull()
    await settleTinderPrefetch()
    expect(calls.length).toBe(3)

    const before = calls.length
    const next = await swipeTinder('chat', 'left')
    expect(next.card?.tinderDesc).toBe('A blurb about them.')
    await settleTinderPrefetch()
    expect(calls.length).toBe(before)
    expect(api.__json.size).toBeGreaterThan(0)
  })

  test('a failing prefetch does not break the swipe', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: () => {
          throw new Error('offline')
        },
      }),
    )
    const first = await initTinder('out')
    expect(first.card?.tinderDesc).toBeNull()
    expect(first.empty).toBe(false)
    await settleTinderPrefetch()
    const sw = await swipeTinder('out', 'left')
    expect(sw.action).toBe('delete')
    await settleTinderPrefetch()
  })
})
