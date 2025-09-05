import { config } from '../../config.js'
import { createLogger } from './logging/logger.js'

import { createServer } from '../../server.js'

async function startServer(options = {}) {
  try {
    const server = await createServer(options)
    await server.start()

    server.logger.info('Server started successfully')
    server.logger.info(
      `Access your backend on http://localhost:${config.get('port')}`
    )

    return server
  } catch (error) {
    const logger = createLogger()
    logger.info('Server failed to start :(')
    logger.error(error)
    throw error
  }
}

export { startServer }
