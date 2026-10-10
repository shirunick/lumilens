import { beforeEach, describe, expect, test } from 'bun:test'
import {
  clearCachedKind,
  getCache,
  getOrEmpty,
  setCache,
} from '../cache'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('cache', () => {
  beforeEach(() => {
    installSpindleMock(createSpindleMock())
  })

  test('miss returns null', async () => {
    expect(await getCache('missing')).toBeNull()
  })

  test('getOrEmpty returns empty shape', async () => {
    const e = await getOrEmpty('x')
    expect(e.quickOverview).toBeNull()
    expect(e.deepDive).toBeNull()
    expect(e.tinderDesc).toBeNull()
  })

  test('set and get round-trip', async () => {
    await setCache('c1', { quickOverview: 'hello' })
    const e = await getCache('c1')
    expect(e?.quickOverview).toBe('hello')
    expect(e?.generatedAt).toBeGreaterThan(0)
  })

  test('partial merge preserves other fields', async () => {
    await setCache('c1', { quickOverview: 'a', deepDive: 'b' })
    await setCache('c1', { tinderDesc: 'c' })
    const e = await getCache('c1')
    expect(e?.quickOverview).toBe('a')
    expect(e?.deepDive).toBe('b')
    expect(e?.tinderDesc).toBe('c')
  })

  test('corrupt cache falls back via getJson fallback', async () => {
    const api = installSpindleMock(createSpindleMock())
    api.__json.set('cache_v2/c1.json', 'not-an-object' as unknown as object)

    api.__json.set('cache_v2/c1.json', null)
    expect(await getCache('c1')).toBeNull()
  })

  test('clearCachedKind drops only the chosen field', async () => {
    installSpindleMock(createSpindleMock({ characters: sampleCharacters() }))
    await setCache('c1', {
      quickOverview: 'pitch',
      deepDive: 'deep',
      tinderDesc: 'blurb',
    })
    await setCache('c2', { tinderDesc: 'other', deepDive: 'd2' })
    await setCache('c3', { quickOverview: 'only pitch' })

    expect(await clearCachedKind('tinder')).toBe(2)
    const c1 = await getCache('c1')
    expect(c1?.tinderDesc).toBeNull()
    expect(c1?.quickOverview).toBe('pitch')
    expect(c1?.deepDive).toBe('deep')
    expect((await getCache('c2'))?.tinderDesc).toBeNull()
    expect((await getCache('c2'))?.deepDive).toBe('d2')

    expect(await clearCachedKind('quick')).toBe(2)
    expect((await getCache('c1'))?.quickOverview).toBeNull()
    expect((await getCache('c1'))?.deepDive).toBe('deep')
    expect((await getCache('c3'))?.quickOverview).toBeNull()

    expect(await clearCachedKind('deep')).toBe(2)
    expect((await getCache('c1'))?.deepDive).toBeNull()
    expect((await getCache('c2'))?.deepDive).toBeNull()
    expect(await clearCachedKind('tinder')).toBe(0)
  })
})
