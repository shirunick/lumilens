import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const png = readFileSync(resolve(root, 'assets/ari.png'))
const out = resolve(root, 'src/backend/ari-image.ts')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(
  out,
  `export const ARI_DATA_URL = 'data:image/png;base64,${png.toString('base64')}'\n`,
)
