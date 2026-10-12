declare const spindle: import('lumiverse-spindle-types').SpindleAPI

import { startImportWarmListener } from './backend/import-warm'
import { startRpc } from './backend/rpc'

startRpc()
startImportWarmListener()
spindle.log.info('LumiLens backend loaded.')
