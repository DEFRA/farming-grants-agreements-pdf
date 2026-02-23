import { config } from '#~/config.js'
import { createLogger as defaultCreateLogger } from '#~/common/helpers/logging/logger.js'

import { createServer as defaultCreateServer } from '#~/server.js'

async function startServer(options = {}) {
  const {
    createServerFn = defaultCreateServer,
    createLoggerFn = defaultCreateLogger,
    ...serverOptions
  } = options

  try {
    const server = await createServerFn(serverOptions)
    await server.start()

    server.logger.info('Server started successfully')
    server.logger.info(
      `Access your backend on http://localhost:${config.get('port')}`
    )

    return server
  } catch (err) {
    const logger = createLoggerFn()
    logger.info('Server failed to start :(')
    logger.error(err)
    throw err
  }
}

export { startServer }
