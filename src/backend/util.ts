export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  const count = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: count }, worker))
  return out
}

export function createConcurrencyLimit(limit: number | (() => number)): {
  run: <T>(fn: () => Promise<T>, onWait?: (active: number, waiting: number) => void) => Promise<T>
  reset: () => void
  active: () => number
  waiting: () => number
} {
  const getMax = () =>
    Math.max(1, typeof limit === 'function' ? limit() : limit)
  let active = 0
  const waiters: Array<() => void> = []

  return {
    active: () => active,
    waiting: () => waiters.length,
    reset: () => {
      active = 0
      waiters.length = 0
    },
    async run<T>(
      fn: () => Promise<T>,
      onWait?: (activeCount: number, waitingCount: number) => void,
    ): Promise<T> {
      await new Promise<void>((resolve) => {
        const tryEnter = () => {
          if (active < getMax()) {
            active += 1
            resolve()
            return
          }
          waiters.push(tryEnter)
          onWait?.(active, waiters.length)
        }
        tryEnter()
      })
      try {
        return await fn()
      } finally {
        active -= 1
        const next = waiters.shift()
        if (next) next()
      }
    },
  }
}
