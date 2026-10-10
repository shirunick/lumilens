import { beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { setCache } from '../cache'
import {
  cancelWarmLibrary,
  estimateWarmLibrary,
  isWarmLibraryRunning,
  normalizeWarmKinds,
  settleWarmLibrary,
  startWarmLibrary,
} from '../warm-library'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('warm-library', () => {
  beforeEach(async () => {
    cancelWarmLibrary()
    await settleWarmLibrary()
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'warm text',
      }),
    )
  })

  test('normalizeWarmKinds filters and dedupes', () => {
    expect(normalizeWarmKinds(['quick', 'quick', 'nope', 'tinder', 1])).toEqual([
      'quick',
      'tinder',
    ])
    expect(normalizeWarmKinds(null)).toEqual([])
  })

  test('estimate counts only missing kinds', async () => {
    await setCache('c1', { quickOverview: 'have pitch', tinderDesc: 'have blurb' })
    const estimate = await estimateWarmLibrary(['quick', 'deep', 'tinder'])
    expect(estimate.breakdown.quick).toBe(2)
    expect(estimate.breakdown.deep).toBe(3)
    expect(estimate.breakdown.tinder).toBe(2)
    expect(estimate.jobs).toBe(7)
    expect(estimate.cards).toBe(3)
    expect(estimate.inputTokensApprox).toBeGreaterThan(0)
  })

  test('estimate with no kinds is empty', async () => {
    const estimate = await estimateWarmLibrary([])
    expect(estimate.jobs).toBe(0)
    expect(estimate.cards).toBe(0)
    expect(estimate.inputTokensApprox).toBe(0)
  })

  test('start fills missing only and rejects a second start', async () => {
    const api = installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
    api.generate.quiet = async () => {
      await new Promise((r) => setTimeout(r, 40))
      return { content: 'slow warm', finish_reason: 'stop', usage: {} }
    }

    await setCache('c1', {
      quickOverview: 'x',
      deepDive: 'y',
      tinderDesc: 'z',
    })

    const started = await startWarmLibrary(['tinder'])
    expect(started.total).toBe(2)
    expect(isWarmLibraryRunning()).toBe(true)
    await expect(startWarmLibrary(['tinder'])).rejects.toThrow(/already running/i)
    await settleWarmLibrary()
    expect(isWarmLibraryRunning()).toBe(false)

    const again = await estimateWarmLibrary(['tinder'])
    expect(again.jobs).toBe(0)
  })

  test('cancel stops further work', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
      }),
    )
    let calls = 0
    api.generate.quiet = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 30))
      return { content: `gen ${calls}`, finish_reason: 'stop', usage: {} }
    }

    await startWarmLibrary(['quick', 'deep', 'tinder'])
    cancelWarmLibrary()
    await settleWarmLibrary()
    expect(calls).toBeLessThan(9)
    expect(
      api.__frontendMessages.some(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === 'warm_library_done',
      ),
    ).toBe(true)
  })

  test('start with empty kinds throws', async () => {
    await expect(startWarmLibrary([])).rejects.toThrow(/at least one/i)
  })

  test('start reuses a fresh estimate for the same kinds', async () => {
    const est = await estimateWarmLibrary(['quick'])
    expect(est.jobs).toBe(3)
    for (const id of ['c1', 'c2', 'c3']) await setCache(id, { quickOverview: 'q' })
    const r = await startWarmLibrary(['quick'])
    expect(r.total).toBe(3)
    await settleWarmLibrary()
  })

  test('start ignores a stale or mismatched estimate', async () => {
    await estimateWarmLibrary(['deep'])
    for (const id of ['c1', 'c2', 'c3']) await setCache(id, { quickOverview: 'q' })
    expect((await startWarmLibrary(['quick'])).total).toBe(0)
    await settleWarmLibrary()

    await estimateWarmLibrary(['tinder'])
    setSystemTime(new Date(Date.now() + 60_000))
    try {
      for (const id of ['c1', 'c2', 'c3']) await setCache(id, { tinderDesc: 't' })
      expect((await startWarmLibrary(['tinder'])).total).toBe(0)
    } finally {
      setSystemTime()
    }
    await settleWarmLibrary()
  })

  test('start with nothing missing finishes immediately', async () => {
    for (const id of ['c1', 'c2', 'c3']) {
      await setCache(id, {
        quickOverview: 'q',
        deepDive: 'd',
        tinderDesc: 't',
      })
    }
    const r = await startWarmLibrary(['quick'])
    expect(r.total).toBe(0)
    await settleWarmLibrary()
  })
})
