import { beforeEach, describe, expect, test } from 'bun:test'
import { getCache, setCache } from '../cache'

import { deleteCharacter, resolveImageUrl, shortDescription } from '../characters'
import { GenerateError, generateRaw } from '../generate'
import { buildCandidatePool, findCards } from '../picker'
import { parseNlSearchIds } from '../prompts/nl-search'
import { handleFrontendMessage, startRpc } from '../rpc'
import { getSettings } from '../settings'
import {
  initTinder,
  loadQueue,
  reshuffleTinder,
  settleTinderPrefetch,
  swipeTinder,
  undoTinder,
} from '../tinder'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('coverage gaps', () => {
  beforeEach(() => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'ok',
      }),
    )
  })

  test('cache getJson throw path', async () => {
    const api = installSpindleMock(createSpindleMock())
    api.storage.getJson = async () => {
      throw new Error('boom')
    }
    expect(await getCache('x')).toBeNull()
  })

  test('settings getJson throw path', async () => {
    const api = installSpindleMock(createSpindleMock())
    api.storage.getJson = async () => {
      throw new Error('boom')
    }
    expect(await getSettings()).toEqual({
      connectionId: null,
      testingMode: false,
      perActionConnections: false,
      connectionsByAction: {},
    })
  })

  test('resolveImageUrl catch', async () => {
    const api = installSpindleMock(createSpindleMock())
    api.images.get = async () => {
      throw new Error('nope')
    }
    expect(await resolveImageUrl('x')).toBeNull()
  })

  test('shortDescription falls back to personality', () => {
    expect(shortDescription({ description: '', personality: 'p'.repeat(300) }).length).toBe(280)
  })

  test('deleteCharacter', async () => {
    expect(await deleteCharacter('c1')).toBe(true)
    expect(await deleteCharacter('c1')).toBe(false)
  })

  test('generateRaw + GenerateError path via quiet throw', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      throw new Error('provider down')
    }
    await expect(
      generateRaw([{ role: 'user', content: 'x' }]),
    ).rejects.toBeInstanceOf(GenerateError)
  })

  test('parseNlSearch empty and duplicate', () => {
    expect(parseNlSearchIds('', new Set(['a']))).toBeNull()
    expect(parseNlSearchIds('["a","a"]', new Set(['a']))).toEqual(['a'])
  })

  test('buildCandidatePool empty query shuffles', () => {
    const pool = buildCandidatePool(sampleCharacters(), '', ['c1'])
    expect(pool.every((c) => c.id !== 'c1')).toBe(true)
  })

  test('findCards empty pool', async () => {
    installSpindleMock(createSpindleMock({ characters: [] }))
    const r = await findCards({ tags: [], query: 'x' })
    expect(r.characters).toEqual([])
  })

  test('findCards LLM throws falls back', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      throw new Error('llm fail')
    }
    const r = await findCards({ tags: [], query: 'vampire' })
    expect(r.usedLlm).toBe(false)
    expect(r.characters.length).toBeGreaterThan(0)
  })

  test('tinder loadQueue corrupt + empty swipe + current + undo counters', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'bio',
      }),
    )
    api.__json.set('tinder/out.json', { bad: true })
    expect((await loadQueue('out')).remainingIds).toEqual([])

    expect((await swipeTinder('out', 'right')).action).toBe('none')

    api.__json.delete('tinder/out.json')
    await initTinder('out')
    await swipeTinder('out', 'right')
    await swipeTinder('out', 'left')
    const cur = await initTinder('out')
    expect(cur).toBeTruthy()

    api.__json.delete('tinder/chat.json')
    await initTinder('chat')
    await swipeTinder('chat', 'right')
    await undoTinder('chat')
    await swipeTinder('chat', 'left')
    await undoTinder('chat')
  })

  test('tinder bio generation failure sets error', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      throw new Error('bio fail')
    }
    api.__json.delete('tinder/out.json')
    const r = await initTinder('out')
    expect(r.card?.tinderDesc).toBeNull()
    await settleTinderPrefetch()
    expect(r.card?.tinderDesc).toBeNull()
  })

  test('tinder reshuffle bio fail + undo delete_mock counters', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.__setSettings({ testingMode: true })
    api.__json.delete('tinder/out.json')
    await initTinder('out')
    await settleTinderPrefetch()
    await swipeTinder('out', 'left')
    await undoTinder('out')

    for (const key of [...api.__json.keys()]) {
      if (key.startsWith('cache_v2/')) api.__json.delete(key)
    }
    api.generate.quiet = async () => {
      throw new Error('x')
    }
    const r = await reshuffleTinder('out')
    expect(r.card?.tinderDesc).toBeNull()
    await settleTinderPrefetch()
    expect(r.card?.tinderDesc).toBeNull()
  })

  test('tinder empty library + undo empty history + swipe bio fail', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: [], generateContent: 'bio' }),
    )
    const empty = await initTinder('out')
    expect(empty.empty).toBe(true)
    expect((await undoTinder('out')).empty).toBe(true)

    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'bio',
      }),
    )
    const api2 = (globalThis as unknown as { spindle: ReturnType<typeof createSpindleMock> })
      .spindle
    api2.__json.delete('tinder/out.json')
    await initTinder('out')
    await settleTinderPrefetch()

    for (const key of [...api2.__json.keys()]) {
      if (key.startsWith('cache_v2/')) api2.__json.delete(key)
    }
    api2.generate.quiet = async () => {
      throw new Error('next bio fail')
    }
    const sw = await swipeTinder('out', 'right')
    if (sw.card) {
      await settleTinderPrefetch()
      expect(sw.card.tinderDesc).toBeNull()
    }

    api2.__json.delete('tinder/chat.json')
    for (const key of [...api2.__json.keys()]) {
      if (key.startsWith('cache_v2/')) api2.__json.delete(key)
    }
    await initTinder('chat')
    await settleTinderPrefetch()
    for (const key of [...api2.__json.keys()]) {
      if (key.startsWith('cache_v2/')) api2.__json.delete(key)
    }
    api2.generate.quiet = async () => {
      throw 'non-error'
    }
    const cur = await initTinder('chat')
    await settleTinderPrefetch()

    expect(cur).toBeTruthy()
  })

  test('tinder loadQueue throw path', async () => {
    const api = installSpindleMock(createSpindleMock())
    api.storage.getJson = async () => {
      throw new Error('io')
    }
    expect((await loadQueue('out')).mode).toBe('out')
  })

  test('rpc invalid payload with requestId + startRpc + ariError branches', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'ok',
      }),
    )
    await handleFrontendMessage({ requestId: 'z', type: 1 }, 'u')
    expect(api.__frontendMessages.at(-1)).toMatchObject({ type: 'error' })

    await handleFrontendMessage(null, 'u')

    const unsub = startRpc()
    expect(typeof unsub).toBe('function')
    api.__feHandler?.({ type: 'get_settings', requestId: 'live' }, 'u')
    await new Promise((r) => setTimeout(r, 10))
    unsub()

    const { __setTinderModeForTests } = await import('../rpc')
    __setTinderModeForTests('chat')

    api.generate.quiet = async () => {
      throw new GenerateError('direct')
    }
    await handleFrontendMessage(
      {
        type: 'generate_quick_overview',
        requestId: 'ge',
        characterId: 'c1',
        force: true,
      },
      'u',
    )
    expect(api.__frontendMessages.at(-1)).toMatchObject({
      type: 'error',
      message: 'direct',
    })

    api.characters.list = async () => {
      throw new Error('list failed')
    }
    await handleFrontendMessage(
      { type: 'picker_surprise', requestId: 'lf' },
      'u',
    )
    expect(
      (api.__frontendMessages.at(-1) as { message: string }).message,
    ).toMatch(/list failed/)

    api.characters.list = async () => {
      throw 'raw'
    }
    await handleFrontendMessage(
      { type: 'picker_surprise', requestId: 'raw' },
      'u',
    )
    expect(
      (api.__frontendMessages.at(-1) as { message: string }).message,
    ).toMatch(/Something went wrong/)
  })

  test('parseNlSearch JSON.parse throw', () => {
    expect(parseNlSearchIds('[not-json]', new Set(['a']))).toBeNull()
  })

  test('generate stores model when provider returns it', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => ({
      content: 'with model',
      model: 'test-model',
      finish_reason: 'stop',
      usage: {},
    })
    const { generateQuickOverview } = await import('../generate')
    const r = await generateQuickOverview('c1', true)
    expect(r.text).toBe('with model')
    expect((await getCache('c1'))?.modelUsed).toBe('test-model')
  })

  test('setCache after corrupt-looking entry', async () => {
    await setCache('z', { quickOverview: 'q' })
    expect((await getCache('z'))?.quickOverview).toBe('q')
  })
})
