declare const spindle: import('lumiverse-spindle-types').SpindleAPI

import { startRpc } from './backend/rpc'

startRpc()
spindle.log.info('LumiLens backend loaded.')
