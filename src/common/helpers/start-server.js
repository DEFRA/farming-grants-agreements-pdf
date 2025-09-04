import { config } from '../../config.js'

import { createServer } from '../../server.js'

async function startServer(options = {}) {
  const server = await createServer(options)
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  return server
}

export { startServer }
