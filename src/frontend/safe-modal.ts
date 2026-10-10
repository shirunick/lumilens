import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

export const MOBILE_MAX_WIDTH = 640

export function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_MAX_WIDTH
}

const MODAL_SIZES = {
  narrow: { max: 440, gutter: 32 },
  medium: { max: 620, gutter: 32 },
  wide: { max: 1000, gutter: 64 },
} as const

export type ModalSize = keyof typeof MODAL_SIZES

export function modalWidth(size: ModalSize): number {
  const { max, gutter } = MODAL_SIZES[size]
  return Math.min(max, Math.max(320, window.innerWidth - gutter))
}

export function setModalWidth(modal: { root: HTMLElement }, px: number): void {
  if (isMobileViewport()) return
  const container = modal.root.parentElement?.parentElement
  if (!(container instanceof HTMLElement)) return
  container.style.width = `${px}px`
  container.style.maxWidth = `${px}px`
}

export function showSafeModal(
  ctx: SpindleFrontendContext,
  options: {
    title: string
    width?: number
    maxHeight?: number
    persistent?: boolean
    fullscreenOnMobile?: boolean
  },
) {
  const { fullscreenOnMobile, ...modalOptions } = options
  const fullscreen = !!fullscreenOnMobile && isMobileViewport()
  if (fullscreen) {
    modalOptions.width = window.innerWidth
    modalOptions.maxHeight = window.innerHeight
  }

  const modal = ctx.ui.showModal(modalOptions)
  const modalBody = modal.root.parentElement
  const modalContainer = modalBody?.parentElement
  const modalBackdrop = modalContainer?.parentElement
  if (
    !(modalContainer instanceof HTMLElement) ||
    !(modalBackdrop instanceof HTMLElement)
  ) {
    return modal
  }

  const safeTop =
    'var(--app-interactive-safe-top, env(safe-area-inset-top, 0px))'
  const safeBottom = 'env(safe-area-inset-bottom, 0px)'
  const safeLeft = 'env(safe-area-inset-left, 0px)'
  const safeRight = 'env(safe-area-inset-right, 0px)'

  if (fullscreen) {
    Object.assign(modalBackdrop.style, {
      padding: '0',
      alignItems: 'stretch',
      justifyContent: 'stretch',
    })
    Object.assign(modalContainer.style, {
      boxSizing: 'border-box',
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      borderRadius: '0',
      border: '0',
      paddingTop: safeTop,
      paddingRight: safeRight,
      paddingBottom: safeBottom,
      paddingLeft: safeLeft,
    })
    if (modalBody instanceof HTMLElement) {
      Object.assign(modalBody.style, {
        flex: '1 1 auto',
        minHeight: '0',
        overflowY: 'auto',
      })
    }
    return modal
  }

  Object.assign(modalBackdrop.style, {
    paddingTop: `calc(20px + ${safeTop})`,
    paddingRight: `calc(20px + ${safeRight})`,
    paddingBottom: `calc(20px + ${safeBottom})`,
    paddingLeft: `calc(20px + ${safeLeft})`,
  })
  modalContainer.style.maxHeight = `min(${modalContainer.style.maxHeight || '100%'}, 100%)`
  return modal
}
