import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { AriStore } from './frontend/ari-store'
import { startCardInjector } from './frontend/card-injector'
import { createChatOpener } from './frontend/chat-opener'
import { registerAriDrawerTab } from './frontend/drawer-tab'
import { openQuickView } from './frontend/quick-view'
import { RpcClient } from './frontend/rpc-client'
import { addLumiLensStyles } from './frontend/styles'

export function setup(ctx: SpindleFrontendContext) {
  const removeStyle = addLumiLensStyles(ctx)
  const rpc = new RpcClient(ctx)
  const ari = new AriStore()

  const chatOpener = createChatOpener({
    ctx,
    onError: (message) => {
      console.warn('[LumiLens]', message)
    },
  })

  const tab = registerAriDrawerTab({ ctx, rpc, chatOpener, ari })
  const stopInjector = startCardInjector({
    ctx,
    ari,
    onOpenLens: (ref) => {
      void openQuickView({ ctx, rpc, ari }, ref)
    },
  })

  void rpc
    .request({ type: 'get_ari_avatar' })
    .then((r) => ari.set(r.dataUrl))
    .catch(() => ari.set(null))

  return () => {
    stopInjector()
    tab.destroy()
    rpc.destroy()
    removeStyle()
    ctx.dom.cleanup()
  }
}
