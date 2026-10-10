import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { RPC_TIMEOUT_MS } from '../shared/constants'
import type {
  BackendToFrontend,
  FrontendToBackend,
  RequestBody,
  RequestType,
  ResultFor,
} from '../shared/protocol'

type Pending = {
  expect: string
  resolve: (value: BackendToFrontend) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function resultTypeFor(type: string): string {
  return `${type}_result`
}

function newRequestId(): string {
  return `ll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export class RpcClient {
  private pending = new Map<string, Pending>()
  private unsub: (() => void) | null = null
  private alive = true

  constructor(private ctx: SpindleFrontendContext) {
    this.unsub = ctx.onBackendMessage((payload: unknown) => {
      this.onMessage(payload)
    })
  }

  destroy(): void {
    this.alive = false
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('RPC client torn down.'))
    }
    this.pending.clear()
    this.unsub?.()
    this.unsub = null
  }

  private onMessage(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return
    const msg = payload as BackendToFrontend
    if (msg.type === 'warm_library_progress') {
      this.onWarmLibraryProgress?.(msg)
      return
    }
    if (msg.type === 'warm_library_done') {
      this.onWarmLibraryDone?.(msg)
      return
    }
    if (!('requestId' in msg) || typeof msg.requestId !== 'string') return
    const pending = this.pending.get(msg.requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(msg.requestId)
    if (msg.type === 'error') {
      pending.reject(new Error(msg.message || 'Request failed.'))
      return
    }
    if (msg.type !== pending.expect) {
      pending.reject(new Error('I got an answer to a different question.'))
      return
    }
    pending.resolve(msg)
  }

  onWarmLibraryProgress:
    | ((msg: Extract<BackendToFrontend, { type: 'warm_library_progress' }>) => void)
    | null = null

  onWarmLibraryDone:
    | ((msg: Extract<BackendToFrontend, { type: 'warm_library_done' }>) => void)
    | null = null

  request<B extends RequestBody<RequestType>>(
    body: B,
    timeoutMs = RPC_TIMEOUT_MS,
  ): Promise<ResultFor<B['type']>> {
    if (!this.alive) return Promise.reject(new Error('RPC client torn down.'))
    const requestId = newRequestId()
    const payload = { ...body, requestId } as FrontendToBackend

    return new Promise<ResultFor<B['type']>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('That request timed out.'))
      }, timeoutMs)

      this.pending.set(requestId, {
        expect: resultTypeFor(body.type),
        resolve: (v) => resolve(v as ResultFor<B['type']>),
        reject,
        timer,
      })
      this.ctx.sendToBackend(payload)
    })
  }
}
