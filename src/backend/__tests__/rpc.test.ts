import { beforeEach, describe, expect, test } from 'bun:test'
import { handleFrontendMessage } from '../rpc'
import {
  createSpindleMock,
  installSpindleMock,
  sampleCharacters,
} from './spindle-mock'

describe('rpc', () => {
  let api: ReturnType<typeof createSpindleMock>

  beforeEach(() => {
    api = installSpindleMock(
      createSpindleMock({
        characters: sampleCharacters(),
        generateContent: 'Ari text.',
        ariBytes: new Uint8Array([1, 2, 3]),
      }),
    )
  })

  async function send(payload: unknown) {
    await handleFrontendMessage(payload, 'user-1')
    return api.__frontendMessages.pop()
  }

  test('get_settings', async () => {
    const res = await send({ type: 'get_settings', requestId: '1' })
    expect(res).toMatchObject({ type: 'get_settings_result', requestId: '1' })
  })

  test('set_settings', async () => {
    const res = await send({
      type: 'set_settings',
      requestId: '2',
      settings: { testingMode: true },
    })
    expect(res).toMatchObject({
      type: 'set_settings_result',
      settings: { testingMode: true },
    })
  })

  test('list_connections', async () => {
    const res = (await send({
      type: 'list_connections',
      requestId: '3',
    })) as { connections: unknown[] }
    expect(res.connections.length).toBeGreaterThan(0)
  })

  test('get_ari_avatar', async () => {
    const res = (await send({
      type: 'get_ari_avatar',
      requestId: '4',
    })) as { dataUrl: string }
    expect(res.dataUrl).toContain('base64')
  })

  test('get_quick_view + generate overview', async () => {
    const qv = await send({
      type: 'get_quick_view',
      requestId: '5',
      characterId: 'c1',
    })
    expect(qv).toMatchObject({ type: 'get_quick_view_result' })
    const gen = await send({
      type: 'generate_quick_overview',
      requestId: '6',
      characterId: 'c1',
    })
    expect(gen).toMatchObject({
      type: 'generate_quick_overview_result',
      text: 'Ari text.',
    })
  })

  test('generate deep dive and tinder desc', async () => {
    expect(
      await send({
        type: 'generate_deep_dive',
        requestId: '7',
        characterId: 'c1',
      }),
    ).toMatchObject({ type: 'generate_deep_dive_result' })
    expect(
      await send({
        type: 'generate_tinder_desc',
        requestId: '8',
        characterId: 'c1',
      }),
    ).toMatchObject({ type: 'generate_tinder_desc_result' })
  })

  test('picker routes', async () => {
    expect(
      await send({ type: 'picker_surprise', requestId: '9' }),
    ).toMatchObject({ type: 'picker_surprise_result' })
    expect(
      await send({
        type: 'picker_find',
        requestId: '11',
        tags: ['Horror'],
        query: '',
      }),
    ).toMatchObject({ type: 'picker_find_result' })
  })

  test('tinder routes', async () => {
    expect(
      await send({ type: 'tinder_init', requestId: '12', mode: 'out' }),
    ).toMatchObject({ type: 'tinder_init_result' })
    expect(
      await send({
        type: 'tinder_swipe',
        requestId: '14',
        direction: 'right',
      }),
    ).toMatchObject({ type: 'tinder_swipe_result' })
    expect(
      await send({ type: 'tinder_undo', requestId: '15' }),
    ).toMatchObject({ type: 'tinder_undo_result' })
    expect(
      await send({ type: 'tinder_reshuffle', requestId: '16' }),
    ).toMatchObject({ type: 'tinder_reshuffle_result' })
    const cleared = await send({
      type: 'clear_cache_kind',
      requestId: '16b',
      kind: 'tinder',
    })
    expect(cleared).toMatchObject({
      type: 'clear_cache_kind_result',
      kind: 'tinder',
    })
    expect((cleared as { cleared: number }).cleared).toBeGreaterThanOrEqual(0)
  })

  test('warm library routes', async () => {
    expect(
      await send({
        type: 'warm_library_estimate',
        requestId: 'w1',
        kinds: ['quick', 'tinder'],
      }),
    ).toMatchObject({ type: 'warm_library_estimate_result' })
    expect(
      await send({
        type: 'warm_library_start',
        requestId: 'w2',
        kinds: ['tinder'],
      }),
    ).toMatchObject({ type: 'warm_library_start_result' })
    expect(
      await send({ type: 'warm_library_cancel', requestId: 'w3' }),
    ).toMatchObject({ type: 'warm_library_cancel_result' })
  })

  test('unknown type errors', async () => {
    const res = await send({ type: 'nope', requestId: '18' })
    expect(res).toMatchObject({ type: 'error', code: 'unknown_type' })
  })

  test('missing character quick view errors', async () => {
    const res = await send({
      type: 'get_quick_view',
      requestId: '19',
      characterId: 'missing',
    })
    expect(res).toMatchObject({ type: 'error', code: 'not_found' })
  })
})
