import { describe, expect, test } from 'bun:test'
import { getAriAvatarDataUrl } from '../ari-avatar'
import { createSpindleMock, installSpindleMock } from './spindle-mock'

describe('ari-avatar', () => {
  test('returns data url from binary', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    installSpindleMock(createSpindleMock({ ariBytes: bytes }))
    const url = await getAriAvatarDataUrl('')
    expect(url?.startsWith('data:image/png;base64,')).toBe(true)
  })

  test('missing file returns null', async () => {
    installSpindleMock(createSpindleMock())
    expect(await getAriAvatarDataUrl('not-a-data-url')).toBeNull()
  })

  test('embedded data url wins over storage', async () => {
    installSpindleMock(createSpindleMock())
    expect(await getAriAvatarDataUrl('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA',
    )
  })
})
