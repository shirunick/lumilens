import { beforeEach, describe, expect, test } from 'bun:test'
import {
  initTinder,
  reshuffleTinder,
  setActiveTinderMode,
  settleTinderPrefetch,
  swipeTinder,
  undoTinder,
} from '../tinder'
import { generateTinderDesc } from '../generate'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('tinder', () => {
  beforeEach(() => {
    installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'A quiet bio.',
      }),
    )
    setActiveTinderMode('out')
  })

  test('init builds queue and returns card with bio', async () => {
    const r = await initTinder('out')
    expect(r.empty).toBe(false)
    expect(r.card?.character.id).toBeTruthy()
    expect(r.card?.tinderDesc).toBeNull()
    await settleTinderPrefetch()
    const bio = await generateTinderDesc(r.card!.character.id)
    expect(bio.text).toBe('A quiet bio.')
    expect(bio.cached).toBe(true)
  })

  test('keep then advance', async () => {
    await initTinder('out')
    const r = await swipeTinder('out', 'right')
    expect(r.action).toBe('keep')
  })

  test('delete real removes character', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'bio',
      }),
    )
    await initTinder('out')
    const before = api.__characters.length
    const currentId = (await initTinder('out')).card?.character.id

    api.__json.delete('tinder/out.json')
    const init = await initTinder('out')
    const id = init.card!.character.id
    const r = await swipeTinder('out', 'left')
    expect(r.action).toBe('delete')
    expect(api.__characters.find((c) => c.id === id)).toBeUndefined()
    expect(api.__characters.length).toBe(before - 1)
    void currentId
  })

  test('delete mock logs and keeps character', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'bio',
      }),
    )
    api.__setSettings({ testingMode: true })
    api.__json.delete('tinder/out.json')
    const init = await initTinder('out')
    const id = init.card!.character.id
    const r = await swipeTinder('out', 'left')
    expect(r.action).toBe('delete_mock')
    expect(api.__characters.find((c) => c.id === id)).toBeTruthy()
    expect(api.__logs.some((l) => l.includes('testingMode'))).toBe(true)
  })

  test('chat accept and decline', async () => {
    await initTinder('chat')
    const accept = await swipeTinder('chat', 'right')
    expect(accept.action).toBe('accept')
    const decline = await swipeTinder('chat', 'left')
    expect(decline.action).toBe('decline')
  })

  test('undo restores card to front', async () => {
    apiReset()
    const init = await initTinder('out')
    const id = init.card!.character.id
    await swipeTinder('out', 'right')
    const undone = await undoTinder('out')
    expect(undone.card?.character.id).toBe(id)
  })

  test('reshuffle rebuilds', async () => {
    await initTinder('out')
    const r = await reshuffleTinder('out')
    expect(r.empty).toBe(false)
  })

  test('skips missing character in queue', async () => {
    const api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'bio',
      }),
    )
    api.__json.set('tinder/out.json', {
      mode: 'out',
      remainingIds: ['gone', 'c2'],
      history: [],
      kept: 0,
      deleted: 0,
      declined: 0,
      accepted: 0,
    })
    const r = await initTinder('out')
    expect(r.card?.character.id).toBe('c2')
  })
})

function apiReset() {
  installSpindleMock(
    createSpindleMock({
      characters: sampleCharacters(),
      generateContent: 'bio',
    }),
  )
}
