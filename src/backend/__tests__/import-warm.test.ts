import { beforeEach, describe, expect, test } from 'bun:test'
import { getCache } from '../cache'
import { setSettings } from '../settings'
import {
  characterFromCreatedPayload,
  startImportWarmListener,
  __enqueueWarmForTests,
  __resetImportWarmForTests,
  __settleImportWarmForTests,
} from '../import-warm'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('import-warm', () => {
  beforeEach(() => {
    __resetImportWarmForTests()
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'Generated text from Ari.',
      }),
    )
  })

  test('characterFromCreatedPayload maps host payload', () => {
    const dto = characterFromCreatedPayload('x1', {
      name: 'N',
      description: 'D',
      tags: ['a', 1, 'b'],
      alternate_greetings: ['hi'],
    })
    expect(dto.id).toBe('x1')
    expect(dto.name).toBe('N')
    expect(dto.tags).toEqual(['a', 'b'])
    expect(dto.alternate_greetings).toEqual(['hi'])
  })

  test('disabled setting skips warm', async () => {
    await setSettings({ warmOnImport: false })
    await __enqueueWarmForTests('c1', sampleCharacters()[0])
    const cache = await getCache('c1')
    expect(cache).toBeNull()
  })

  test('separate calls fill missing kinds on create', async () => {
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick', 'deep', 'tinder'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1')
    const cache = await getCache('c1')
    expect(cache?.quickOverview).toBe('Generated text from Ari.')
    expect(cache?.deepDive).toBe('Generated text from Ari.')
    expect(cache?.tinderDesc).toBe('Generated text from Ari.')
  })

  test('only selected kinds are warmed', async () => {
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick', 'tinder'],
    })
    await __enqueueWarmForTests('c2', sampleCharacters()[1], 'u1')
    const cache = await getCache('c2')
    expect(cache?.quickOverview).toBe('Generated text from Ari.')
    expect(cache?.tinderDesc).toBe('Generated text from Ari.')
    expect(cache?.deepDive).toBeNull()
  })

  test('CHARACTER_CREATED listener warms when enabled', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'From event.',
      }),
    )
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    startImportWarmListener()
    api.__emit(
      'CHARACTER_CREATED',
      { id: 'c3', character: sampleCharacters()[2] },
      'u1',
    )
    await __settleImportWarmForTests()
    const cache = await getCache('c3')
    expect(cache?.quickOverview).toBe('From event.')
  })

  test('skips kinds already cached', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'should-not-run',
      }),
    )
    api.__setCache('c1', { quickOverview: 'already' })
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0])
    const cache = await getCache('c1')
    expect(cache?.quickOverview).toBe('already')
  })

  test('separate kind failure is swallowed', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      throw new Error('provider down')
    }
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1')
    expect(await getCache('c1')).toBeNull()
    expect(api.__logs.some((l) => l.includes('import warm quick failed'))).toBe(
      true,
    )
  })

  test('startImportWarmListener without spindle.on', () => {
    const api = installSpindleMock(createSpindleMock())
    delete (api as { on?: unknown }).on
    const stop = startImportWarmListener()
    stop()
    expect(api.__logs.some((l) => l.includes('spindle.on missing'))).toBe(true)
  })

  test('startImportWarmListener unsubscribes', () => {
    installSpindleMock(createSpindleMock())
    const stop = startImportWarmListener()
    stop()
    const again = startImportWarmListener()
    again()
  })

  test('CHARACTER_DELETED removes cache', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.__setCache('c1', { quickOverview: 'bye' })
    startImportWarmListener()
    api.__emit('CHARACTER_DELETED', { id: 'c1' })
    await new Promise((r) => setTimeout(r, 0))
    expect(await getCache('c1')).toBeNull()
    expect(
      api.__logs.some((l) => l.includes('char delete notice id=c1')),
    ).toBe(true)
  })

  test('global warm queue caps concurrent LLM calls', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 30))
      concurrent -= 1
      return { content: 'ok', finish_reason: 'stop', usage: {} }
    }
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await Promise.all([
      __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1'),
      __enqueueWarmForTests('c2', sampleCharacters()[1], 'u1'),
      __enqueueWarmForTests('c3', sampleCharacters()[2], 'u1'),
    ])
    expect(maxConcurrent).toBeLessThanOrEqual(2)
    expect(maxConcurrent).toBeGreaterThanOrEqual(1)
    expect(api.__logs.some((l) => l.includes('queue (quick)'))).toBe(true)
  })
})
