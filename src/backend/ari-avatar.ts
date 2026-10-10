import { STORAGE } from '../shared/constants'
import { ARI_DATA_URL } from './ari-image'

declare const spindle: import('lumiverse-spindle-types').SpindleAPI

export async function getAriAvatarDataUrl(
  embedded: string = ARI_DATA_URL,
): Promise<string | null> {
  if (embedded.startsWith('data:')) return embedded
  try {
    const bytes = await spindle.storage.readBinary(STORAGE.ariPng)
    if (!bytes || bytes.length === 0) return null
    const b64 = Buffer.from(bytes).toString('base64')
    return `data:image/png;base64,${b64}`
  } catch {
    return null
  }
}
