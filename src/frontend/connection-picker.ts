import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import {
  DEFAULT_SETTINGS,
  LLM_ACTIONS,
  type ConnectionInfo,
  type LlmAction,
  type Settings,
  type WarmKind,
} from '../shared/types'
import type { RpcClient } from './rpc-client'
import { button, collapsiblePanel, errorMessage, h, switchRow } from './ui'

const ACTION_LABELS: Record<LlmAction, string> = {
  quick: 'Quick Pitch',
  deep: 'Deep Dive',
  tinder: 'Tinder blurb',
  search: 'Card search',
}

type Estimate = {
  jobs: number
  cards: number
  inputTokensApprox: number
}

type ClearCopy = {
  label: string
  title: string
  message: string
  confirm: string
  one: string
  many: (n: number) => string
}

const CLEAR_COPY: Record<WarmKind, ClearCopy> = {
  quick: {
    label: 'Clear Quick Pitches',
    title: 'Clear saved Quick Pitches?',
    message: 'I forget every Quick Pitch and write them fresh next time. Deep Dives and Tinder blurbs stay.',
    confirm: 'Clear pitches',
    one: 'Forgot 1 pitch.',
    many: (n) => `Forgot ${n} pitches.`,
  },
  deep: {
    label: 'Clear Deep Dives',
    title: 'Clear saved Deep Dives?',
    message: 'I forget every Deep Dive and read the cards again next time. Quick Pitches and Tinder blurbs stay.',
    confirm: 'Clear deep dives',
    one: 'Forgot 1 deep dive.',
    many: (n) => `Forgot ${n} deep dives.`,
  },
  tinder: {
    label: 'Clear Tinder blurbs',
    title: 'Clear saved Tinder blurbs?',
    message: 'I forget every Tinder blurb and write new ones as you swipe. Quick Pitches and Deep Dives stay.',
    confirm: 'Clear blurbs',
    one: 'Forgot 1 blurb.',
    many: (n) => `Forgot ${n} blurbs.`,
  },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function mountConnectionPicker(
  host: HTMLElement,
  rpc: RpcClient,
  ctx: SpindleFrontendContext,
): {
  refresh: () => Promise<void>
  destroy: () => void
} {
  let settings: Settings = { ...DEFAULT_SETTINGS, connectionsByAction: {} }
  let connections: ConnectionInfo[] = []
  let estimate: Estimate = { jobs: 0, cards: 0, inputTokensApprox: 0 }
  let estimateKey: string | null = null
  let warming = false
  let estimateTimer: ReturnType<typeof setTimeout> | null = null

  const select = h('select', {
    class: 'll-select',
    title: 'The LLM connection Ari uses',
    'aria-label': 'LLM connection',
  })
  const warn = h('div', { class: 'll-warn', hidden: true })
  const perActionCb = h('input', { type: 'checkbox', class: 'll-switch' })
  const sharedRow = h('div', { class: 'll-conn-shared' }, [select])
  const actionSelects = {} as Record<LlmAction, HTMLSelectElement>
  const actionRows = LLM_ACTIONS.map((action) => {
    const el = h('select', {
      class: 'll-select',
      title: `${ACTION_LABELS[action]} connection`,
      'aria-label': `${ACTION_LABELS[action]} connection`,
    }) as HTMLSelectElement
    actionSelects[action] = el
    el.onchange = () => void save().catch(() => {})
    return h('label', { class: 'll-conn-field' }, [
      h('span', { class: 'll-conn-label', text: ACTION_LABELS[action] }),
      el,
    ])
  })
  const perActionBox = h('div', { class: 'll-conn-actions', hidden: true }, actionRows)
  const testingCb = h('input', { type: 'checkbox', class: 'll-switch' })
  const clearStatus = h('div', { class: 'll-muted' })

  const clearBtns = (['quick', 'deep', 'tinder'] as const).map((kind) => {
    const btn = button(CLEAR_COPY[kind].label, {
      kind: 'ghost',
      onClick: () => void clearKind(kind),
    })
    btn.classList.add('ll-btn-block')
    btn.dataset.clearKind = kind
    return btn
  })

  const kindQuick = h('input', { type: 'checkbox', class: 'll-switch' })
  const kindDeep = h('input', { type: 'checkbox', class: 'll-switch' })
  const kindTinder = h('input', { type: 'checkbox', class: 'll-switch' })
  const estimateLine = h('div', {
    class: 'll-muted',
    text: 'Tick a kind and I will estimate the cost.',
  })
  const warmStatus = h('div', { class: 'll-muted' })
  const warmBtn = button('Warm library', {
    kind: 'primary',
    onClick: () => void startWarm(),
  })
  warmBtn.classList.add('ll-btn-block')
  const stopBtn = button('Stop', {
    kind: 'ghost',
    onClick: () => void stopWarm(),
  })
  stopBtn.classList.add('ll-btn-block')
  stopBtn.hidden = true

  host.replaceChildren(
    collapsiblePanel(
      'LLM connection',
      [
        sharedRow,
        switchRow(
          'Use a connection per action',
          perActionCb,
          'Give me a different model for Quick Pitch, Deep Dive, Tinder blurbs, and card search. Anything left on default falls back to the one above.',
        ),
        perActionBox,
        warn,
      ],
      { open: false },
    ),
    collapsiblePanel(
      'Cache',
      [
        h('div', {
          class: 'll-muted',
          text: 'I keep what I write so I do not repeat myself. Clear a kind and I start over.',
        }),
        ...clearBtns,
        clearStatus,
        h('div', {
          class: 'll-muted',
          text: 'Or let me write the missing pieces ahead of time. I only do the kinds you tick.',
        }),
        switchRow('Quick Pitch', kindQuick),
        switchRow('Deep Dive', kindDeep),
        switchRow('Tinder blurb', kindTinder),
        estimateLine,
        warmBtn,
        stopBtn,
        warmStatus,
      ],
      { open: false },
    ),
    collapsiblePanel(
      'Testing / Debug',
      [
        h('div', { class: 'll-subcat' }, [
          h('div', { class: 'll-subcat-title', text: 'Tinder' }),
          switchRow(
            'Testing mode',
            testingCb,
            'I only pretend to delete in Tinder. Nothing actually leaves your library.',
          ),
        ]),
      ],
      { open: false },
    ),
  )

  function selectedKinds(): WarmKind[] {
    const kinds: WarmKind[] = []
    if (kindQuick.checked) kinds.push('quick')
    if (kindDeep.checked) kinds.push('deep')
    if (kindTinder.checked) kinds.push('tinder')
    return kinds
  }

  function renderEstimate(): void {
    if (selectedKinds().length === 0) {
      estimateLine.textContent = 'Tick at least one kind.'
      return
    }
    const jobs = estimate.jobs
    const tokens = formatTokens(estimate.inputTokensApprox)
    const cards = estimate.cards
    estimateLine.textContent =
      jobs === 0
        ? 'Nothing missing. I already wrote all of it.'
        : `${jobs} job${jobs === 1 ? '' : 's'} · ~${tokens} input tokens · ${cards} card${cards === 1 ? '' : 's'}`
  }

  function setWarming(on: boolean): void {
    warming = on
    warmBtn.hidden = on
    stopBtn.hidden = !on
    kindQuick.disabled = on
    kindDeep.disabled = on
    kindTinder.disabled = on
    for (const btn of clearBtns) btn.disabled = on
  }

  function fillSelect(el: HTMLSelectElement, value: string | null): void {
    el.replaceChildren(
      h('option', { value: '', text: 'Default connection' }),
      ...connections.map((c) =>
        h('option', {
          value: c.id,
          text: `${c.name}${c.model ? ` · ${c.model}` : ''}${c.is_default ? ' (default)' : ''}${c.has_api_key ? '' : ' (no API key)'}`,
        }),
      ),
    )
    el.value = value || ''
  }

  function syncPerActionUi(): void {
    perActionBox.hidden = !perActionCb.checked
  }

  function updateWarn(): void {
    const ids = [
      select.value,
      ...(perActionCb.checked
        ? LLM_ACTIONS.map((a) => actionSelects[a].value)
        : []),
    ].filter(Boolean)
    const bad = connections.filter((c) => ids.includes(c.id) && !c.has_api_key)
    if (bad.length === 0) {
      warn.hidden = true
      warn.textContent = ''
      return
    }
    warn.hidden = false
    warn.textContent =
      bad.length === 1
        ? `${bad[0].name} has no API key.`
        : `${bad.length} selected connections have no API key.`
  }

  function renderSelect(): void {
    fillSelect(select, settings.connectionId)
    for (const action of LLM_ACTIONS) {
      const value =
        settings.connectionsByAction[action] !== undefined
          ? settings.connectionsByAction[action] ?? null
          : settings.connectionId
      fillSelect(actionSelects[action], value)
    }
    perActionCb.checked = settings.perActionConnections
    syncPerActionUi()
    updateWarn()
  }

  function readConnectionsByAction(): Partial<Record<LlmAction, string | null>> {
    const out: Partial<Record<LlmAction, string | null>> = {}
    for (const action of LLM_ACTIONS) {
      out[action] = actionSelects[action].value || null
    }
    return out
  }

  async function save(): Promise<void> {
    updateWarn()
    const next = await rpc.request({
      type: 'set_settings',
      settings: {
        connectionId: select.value || null,
        testingMode: testingCb.checked,
        perActionConnections: perActionCb.checked,
        connectionsByAction: readConnectionsByAction(),
      },
    })
    settings = next.settings
  }

  async function clearKind(kind: WarmKind): Promise<void> {
    const btn = clearBtns.find((b) => b.dataset.clearKind === kind)
    if (!btn || btn.disabled || warming) return
    const copy = CLEAR_COPY[kind]
    const { confirmed } = await ctx.ui.showConfirm({
      title: copy.title,
      message: copy.message,
      variant: 'danger',
      confirmLabel: copy.confirm,
    })
    if (!confirmed) return
    for (const b of clearBtns) b.disabled = true
    clearStatus.textContent = 'Forgetting.'
    try {
      const r = await rpc.request({ type: 'clear_cache_kind', kind })
      clearStatus.textContent =
        r.cleared === 0
          ? 'Nothing to forget.'
          : r.cleared === 1
            ? copy.one
            : copy.many(r.cleared)
      await refreshEstimate()
    } catch (e) {
      clearStatus.textContent = errorMessage(e, 'I could not clear that.')
    } finally {
      for (const b of clearBtns) b.disabled = warming
    }
  }

  async function refreshEstimate(): Promise<void> {
    const kinds = selectedKinds()
    estimateKey = null
    if (kinds.length === 0) {
      estimate = { jobs: 0, cards: 0, inputTokensApprox: 0 }
      renderEstimate()
      return
    }
    estimateLine.textContent = 'Counting.'
    try {
      const r = await rpc.request({ type: 'warm_library_estimate', kinds })
      estimate = {
        jobs: r.jobs,
        cards: r.cards,
        inputTokensApprox: r.inputTokensApprox,
      }
      estimateKey = kinds.join(',')
      renderEstimate()
    } catch (e) {
      estimateLine.textContent = errorMessage(e, 'I could not count that.')
    }
  }

  function scheduleEstimate(): void {
    if (estimateTimer) clearTimeout(estimateTimer)
    estimateTimer = setTimeout(() => {
      estimateTimer = null
      void refreshEstimate()
    }, 300)
  }

  async function startWarm(): Promise<void> {
    if (warming) return
    const kinds = selectedKinds()
    if (kinds.length === 0) {
      warmStatus.textContent = 'Tick at least one kind.'
      return
    }
    if (estimateTimer || estimateKey !== kinds.join(',')) {
      if (estimateTimer) clearTimeout(estimateTimer)
      estimateTimer = null
      await refreshEstimate()
    }
    if (estimate.jobs === 0) {
      warmStatus.textContent = 'Nothing missing. I already wrote all of it.'
      return
    }
    const { confirmed } = await ctx.ui.showConfirm({
      title: 'Warm the library?',
      message: `I will write ${estimate.jobs} missing piece${estimate.jobs === 1 ? '' : 's'} across ${estimate.cards} card${estimate.cards === 1 ? '' : 's'}. Roughly ${formatTokens(estimate.inputTokensApprox)} input tokens.`,
      variant: 'success',
      confirmLabel: 'Start',
    })
    if (!confirmed) return

    setWarming(true)
    warmStatus.textContent = 'Getting started.'
    try {
      const r = await rpc.request({ type: 'warm_library_start', kinds })
      if (r.total === 0) {
        setWarming(false)
        warmStatus.textContent = 'Nothing missing. I already wrote all of it.'
        await refreshEstimate()
      } else {
        warmStatus.textContent = `0 / ${r.total}`
      }
    } catch (e) {
      setWarming(false)
      warmStatus.textContent = errorMessage(e, 'I could not get started.')
    }
  }

  async function stopWarm(): Promise<void> {
    try {
      await rpc.request({ type: 'warm_library_cancel' })
      warmStatus.textContent = 'Stopping after the cards I am on.'
    } catch (e) {
      warmStatus.textContent = errorMessage(e, 'I could not stop.')
    }
  }

  rpc.onWarmLibraryProgress = (msg) => {
    if (!warming) setWarming(true)
    const name = msg.currentName ? ` · ${msg.currentName}` : ''
    const fail =
      msg.failed > 0
        ? ` · ${msg.failed} failed`
        : ''
    warmStatus.textContent = `${msg.done} / ${msg.total}${fail}${name}`
  }

  rpc.onWarmLibraryDone = (msg) => {
    setWarming(false)
    const failed =
      msg.failed > 0
        ? ` ${msg.failed} failed.`
        : ''
    if (msg.cancelled) {
      warmStatus.textContent = `Stopped at ${msg.done} / ${msg.total}.${failed}`
    } else if (msg.total === 0) {
      warmStatus.textContent = 'Nothing missing. I already wrote all of it.'
    } else {
      warmStatus.textContent = `Done. I wrote ${msg.done}.${failed}`
    }
    void refreshEstimate()
  }

  select.onchange = () => void save().catch(() => {})
  perActionCb.onchange = () => {
    if (perActionCb.checked) {
      for (const action of LLM_ACTIONS) {
        actionSelects[action].value = select.value
      }
    }
    syncPerActionUi()
    void save().catch(() => {})
  }
  testingCb.onchange = () => void save().catch(() => {})
  kindQuick.onchange = () => scheduleEstimate()
  kindDeep.onchange = () => scheduleEstimate()
  kindTinder.onchange = () => scheduleEstimate()

  async function refresh(): Promise<void> {
    const s = await rpc.request({ type: 'get_settings' })
    settings = s.settings
    testingCb.checked = settings.testingMode

    const c = await rpc.request({ type: 'list_connections' })
    connections = c.connections
    renderSelect()
    await refreshEstimate()
  }

  return {
    refresh,
    destroy: () => {
      if (estimateTimer) clearTimeout(estimateTimer)
      if (rpc.onWarmLibraryProgress) rpc.onWarmLibraryProgress = null
      if (rpc.onWarmLibraryDone) rpc.onWarmLibraryDone = null
    },
  }
}
