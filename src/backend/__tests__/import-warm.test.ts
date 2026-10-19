import { beforeEach, describe, expect, test } from 'bun:test'
import { getCache } from '../cache'
import { setSettings } from '../settings'
import {
  characterFromCreatedPayload,
  startImportWarmListener,
  __awaitSeedForTests,
  __enqueueWarmForTests,
  __knownIdsForTests,
  __resetImportWarmForTests,
  __setRateLimitBackoffForTests,
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

  test('CHARACTER_LIBRARY_CHANGED warms only imported new ids', async () => {
    const base = sampleCharacters()
    const api = installSpindleMock(
      createSpindleMock({
        characters: base,
        generateContent: 'Bulk warm.',
      }),
    )
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    startImportWarmListener()
    await __awaitSeedForTests()
    expect(__knownIdsForTests().sort()).toEqual(['c1', 'c2', 'c3'])

    api.__characters.push(
      {
        id: 'c4',
        name: 'New One',
        description: 'fresh',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        tags: [],
        alternate_greetings: [],
        creator: '',
        image_id: null,
        updated_at: 200,
      },
      {
        id: 'c5',
        name: 'New Two',
        description: 'fresh',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        tags: [],
        alternate_greetings: [],
        creator: '',
        image_id: null,
        updated_at: 201,
      },
    )

    api.__emit(
      'CHARACTER_LIBRARY_CHANGED',
      { reason: 'bulk_import', imported: 2, jobId: 'j1' },
      'u1',
    )
    await new Promise((r) => setTimeout(r, 20))
    await __settleImportWarmForTests()

    expect(await getCache('c4')).toMatchObject({ quickOverview: 'Bulk warm.' })
    expect(await getCache('c5')).toMatchObject({ quickOverview: 'Bulk warm.' })
    expect(await getCache('c1')).toBeNull()
    expect(await getCache('c2')).toBeNull()
    expect(await getCache('c3')).toBeNull()
  })

  test('CHARACTER_LIBRARY_CHANGED without prior seed warms newest imported', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters().map((c, i) => ({
          ...c,
          updated_at: i + 1,
        })),
        generateContent: 'Unseeded warm.',
      }),
    )
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    startImportWarmListener()
    expect(__knownIdsForTests()).toEqual([])

    api.__characters.push(
      {
        id: 'c4',
        name: 'New One',
        description: 'fresh',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        tags: [],
        alternate_greetings: [],
        creator: '',
        image_id: null,
        updated_at: 100,
      },
      {
        id: 'c5',
        name: 'New Two',
        description: 'fresh',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        tags: [],
        alternate_greetings: [],
        creator: '',
        image_id: null,
        updated_at: 101,
      },
    )

    api.__emit(
      'CHARACTER_LIBRARY_CHANGED',
      { reason: 'bulk_import', imported: 2 },
      'u1',
    )
    await new Promise((r) => setTimeout(r, 20))
    await __settleImportWarmForTests()

    expect(await getCache('c4')).toMatchObject({
      quickOverview: 'Unseeded warm.',
    })
    expect(await getCache('c5')).toMatchObject({
      quickOverview: 'Unseeded warm.',
    })
    expect(await getCache('c1')).toBeNull()
    expect(await getCache('c3')).toBeNull()
  })

  test('CHARACTER_LIBRARY_CHANGED ignores zero imported', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'Nope.',
      }),
    )
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    startImportWarmListener()
    await __awaitSeedForTests()
    api.__characters.push({
      id: 'c9',
      name: 'Ghost',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      tags: [],
      alternate_greetings: [],
      creator: '',
      image_id: null,
      updated_at: 999,
    })
    api.__emit('CHARACTER_LIBRARY_CHANGED', { reason: 'refresh', imported: 0 })
    await new Promise((r) => setTimeout(r, 0))
    await __settleImportWarmForTests()
    expect(await getCache('c9')).toBeNull()
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

  test('warm retries 429 then succeeds', async () => {
    let attempts = 0
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      attempts += 1
      if (attempts < 3) {
        throw new Error('OpenRouter generate failed (429): Provider returned error')
      }
      return { content: 'After retry.', finish_reason: 'stop', usage: {} }
    }
    __setRateLimitBackoffForTests([0, 0, 0])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1')
    expect(attempts).toBe(3)
    expect(await getCache('c1')).toMatchObject({
      quickOverview: 'After retry.',
    })
    expect(
      api.__logs.some(
        (l) => l.includes('429') && l.includes('retry 2/3') && l.includes('global cool-down'),
      ),
    ).toBe(true)
  })

  test('warm stops after three 429 retries', async () => {
    let attempts = 0
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      attempts += 1
      throw new Error('OpenRouter generate failed (429): Provider returned error')
    }
    __setRateLimitBackoffForTests([0, 0, 0])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1')
    expect(attempts).toBe(4)
    expect(await getCache('c1')).toBeNull()
  })

  test('429 retry requeues behind already waiting warm work', async () => {
    const chars = sampleCharacters()
    const order: string[] = []
    let vampire429Left = 1
    let releaseFail!: () => void
    const failGate = new Promise<void>((resolve) => {
      releaseFail = resolve
    })
    const api = installSpindleMock(
      createSpindleMock({ characters: chars }),
    )
    api.generate.quiet = async ({ messages }) => {
      const blob = JSON.stringify(messages)
      const who = blob.includes('Vampire Lord')
        ? 'c1'
        : blob.includes('Space Cadet')
          ? 'c2'
          : '?'
      order.push(who)
      if (who === 'c1' && vampire429Left > 0) {
        vampire429Left -= 1
        await failGate
        throw new Error('OpenRouter generate failed (429): Provider returned error')
      }
      await new Promise((r) => setTimeout(r, 15))
      return { content: `ok-${who}`, finish_reason: 'stop', usage: {} }
    }
    __setRateLimitBackoffForTests([0])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
      warmOnImportConcurrency: 1,
    })

    const p1 = __enqueueWarmForTests('c1', chars[0], 'u1')
    for (let i = 0; i < 50 && order.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 2))
    }
    const p2 = __enqueueWarmForTests('c2', chars[1], 'u1')
    for (let i = 0; i < 50; i++) {
      if (api.__logs.some((l) => l.includes('queue (quick)') && l.includes('c2'))) {
        break
      }
      await new Promise((r) => setTimeout(r, 2))
    }
    releaseFail()
    await Promise.all([p1, p2])

    expect(order).toEqual(['c1', 'c2', 'c1'])
    expect(await getCache('c1')).toMatchObject({ quickOverview: 'ok-c1' })
    expect(await getCache('c2')).toMatchObject({ quickOverview: 'ok-c2' })
  })

  test('non-429 warm failures are not retried', async () => {
    let attempts = 0
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      attempts += 1
      throw new Error('OpenRouter generate failed (500): boom')
    }
    __setRateLimitBackoffForTests([0])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
    })
    await __enqueueWarmForTests('c1', sampleCharacters()[0], 'u1')
    expect(attempts).toBe(1)
    expect(await getCache('c1')).toBeNull()
    expect(api.__logs.some((l) => l.includes('retry'))).toBe(false)
  })

  test('concurrent 429s in one wave stay on the first cool-down step', async () => {
    const chars = sampleCharacters()
    let failsLeft = 2
    const api = installSpindleMock(
      createSpindleMock({ characters: chars }),
    )
    api.generate.quiet = async () => {
      if (failsLeft > 0) {
        failsLeft -= 1
        throw new Error('OpenRouter generate failed (429): Provider returned error')
      }
      return { content: 'ok', finish_reason: 'stop', usage: {} }
    }
    __setRateLimitBackoffForTests([100, 5_000, 15_000])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick', 'deep'],
      warmOnImportConcurrency: 2,
    })

    await __enqueueWarmForTests('c1', chars[0], 'u1')

    const coolLogs = api.__logs.filter((l) => l.includes('global cool-down'))
    expect(coolLogs.length).toBeGreaterThanOrEqual(2)
    expect(coolLogs.every((l) => !l.includes('5000ms') && !l.includes('15000ms'))).toBe(
      true,
    )
    expect(coolLogs.some((l) => /global cool-down \d{2,3}ms/.test(l))).toBe(true)
    expect(await getCache('c1')).toMatchObject({
      quickOverview: 'ok',
      deepDive: 'ok',
    })
  })

  test('429 pauses the whole warm queue, not only the failed kind', async () => {
    const chars = sampleCharacters()
    const times: number[] = []
    let failLeft = 1
    const api = installSpindleMock(
      createSpindleMock({ characters: chars }),
    )
    api.generate.quiet = async () => {
      times.push(Date.now())
      if (failLeft > 0) {
        failLeft -= 1
        throw new Error('OpenRouter generate failed (429): Provider returned error')
      }
      return { content: 'ok', finish_reason: 'stop', usage: {} }
    }
    __setRateLimitBackoffForTests([80])
    await setSettings({
      warmOnImport: true,
      warmOnImportKinds: ['quick'],
      warmOnImportConcurrency: 1,
    })

    await Promise.all([
      __enqueueWarmForTests('c1', chars[0], 'u1'),
      __enqueueWarmForTests('c2', chars[1], 'u1'),
    ])

    expect(times.length).toBe(3)
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(70)
    expect(await getCache('c1')).toMatchObject({ quickOverview: 'ok' })
    expect(await getCache('c2')).toMatchObject({ quickOverview: 'ok' })
    expect(api.__logs.some((l) => l.includes('global cool-down'))).toBe(true)
  })
})
