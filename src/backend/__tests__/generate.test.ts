import { beforeEach, describe, expect, test } from 'bun:test'
import {
  generateDeepDive,
  generateQuickOverview,
  generateTinderDesc,
} from '../generate'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('generate', () => {
  beforeEach(() => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'Overview from Ari.',
      }),
    )
  })

  test('cache miss generates and stores overview', async () => {
    const r = await generateQuickOverview('c1', false)
    expect(r.cached).toBe(false)
    expect(r.text).toBe('Overview from Ari.')
    const again = await generateQuickOverview('c1', false)
    expect(again.cached).toBe(true)
    expect(again.text).toBe('Overview from Ari.')
  })

  test('force regenerates', async () => {
    await generateQuickOverview('c1', false)
    const api = (globalThis as unknown as { spindle: ReturnType<typeof createSpindleMock> })
      .spindle
    let calls = 0
    api.generate.quiet = async () => {
      calls++
      return { content: `regen-${calls}`, finish_reason: 'stop', usage: {} }
    }
    const r = await generateQuickOverview('c1', true)
    expect(r.cached).toBe(false)
    expect(r.text).toBe('regen-1')
  })

  test('deep dive and tinder desc', async () => {
    const d = await generateDeepDive('c1')
    expect(d.text.length).toBeGreaterThan(0)
    expect((await generateDeepDive('c1')).cached).toBe(true)
    const t = await generateTinderDesc('c2')
    expect(t.text.length).toBeGreaterThan(0)
    expect((await generateTinderDesc('c2')).cached).toBe(true)
  })

  test('missing character throws Ari voice', async () => {
    await expect(generateQuickOverview('nope')).rejects.toThrow(/gone/i)
  })

  test('empty model content throws', async () => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: '   ',
      }),
    )
    await expect(generateQuickOverview('c1', true)).rejects.toThrow()
  })
})
