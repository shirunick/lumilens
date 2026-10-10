import { beforeEach, describe, expect, test } from 'bun:test'
import {
  getCharacter,
  listAllCharacters,
  resolveImageUrl,
  shortDescription,
  toSummary,
} from '../characters'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
  type MockCharacter,
} from './spindle-mock'

describe('characters', () => {
  beforeEach(() => {
    installSpindleMock(
      createSpindleMock({ characters: sampleCharacters() }),
    )
  })

  test('listAllCharacters paginates', async () => {
    const many: MockCharacter[] = Array.from({ length: 250 }, (_, i) => ({
      ...sampleCharacters()[0],
      id: `id-${i}`,
      name: `Char ${i}`,
    }))
    installSpindleMock(createSpindleMock({ characters: many }))
    const all = await listAllCharacters()
    expect(all.length).toBe(250)
  })

  test('getCharacter', async () => {
    expect((await getCharacter('c1'))?.name).toBe('Vampire Lord')
    expect(await getCharacter('nope')).toBeNull()
  })

  test('resolveImageUrl', async () => {
    expect(await resolveImageUrl(null)).toBeNull()
    expect(await resolveImageUrl('img1')).toContain('img1')
  })

  test('toSummary and shortDescription', async () => {
    const c = (await getCharacter('c1'))!
    const s = await toSummary(c, true)
    expect(s.imageUrl).toBeTruthy()
    expect(s.personality).toBeTruthy()
    expect(shortDescription(c).length).toBeGreaterThan(0)
  })
})
