import { beforeEach, describe, expect, test } from 'bun:test'
import { DEFAULT_SETTINGS } from '../../shared/types'
import {
  getSettings,
  resolveConnectionId,
  setSettings,
} from '../settings'
import { createSpindleMock, installSpindleMock } from './spindle-mock'

describe('settings', () => {
  beforeEach(() => {
    installSpindleMock(createSpindleMock())
  })

  test('defaults', async () => {
    const s = await getSettings()
    expect(s).toEqual(DEFAULT_SETTINGS)
  })

  test('set and get', async () => {
    const next = await setSettings({
      connectionId: 'conn-1',
      testingMode: true,
      perActionConnections: true,
      connectionsByAction: { quick: 'q1', search: null },
    })
    expect(next.connectionId).toBe('conn-1')
    expect(next.testingMode).toBe(true)
    expect(next.perActionConnections).toBe(true)
    expect(next.connectionsByAction).toEqual({ quick: 'q1', search: null })
    expect(await getSettings()).toEqual(next)
  })

  test('partial patch', async () => {
    await setSettings({ connectionId: 'a', testingMode: false })
    const next = await setSettings({ testingMode: true })
    expect(next.connectionId).toBe('a')
    expect(next.testingMode).toBe(true)
    expect(next.perActionConnections).toBe(false)
  })

  test('resolveConnectionId uses per-action when enabled', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      connectionId: 'shared',
      perActionConnections: true,
      connectionsByAction: { deep: 'deep-1' },
    }
    expect(resolveConnectionId(settings, 'deep')).toBe('deep-1')
    expect(resolveConnectionId(settings, 'quick')).toBe('shared')
    expect(
      resolveConnectionId(
        { ...settings, perActionConnections: false },
        'deep',
      ),
    ).toBe('shared')
  })
})
