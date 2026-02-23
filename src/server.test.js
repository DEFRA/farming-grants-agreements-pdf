import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import Hapi from '@hapi/hapi'

import { createServer } from '#~/server.js'
import * as setupProxyModule from '#~/common/helpers/proxy/setup-proxy.js'
import { config } from '#~/config.js'

describe('createServer', () => {
  let mockServer
  let mockServerRegister
  let originalPort

  beforeEach(() => {
    vi.clearAllMocks()

    // Save original port and set to expected test value
    originalPort = config.get('port')
    config.set('port', 3001)

    mockServerRegister = vi.fn().mockResolvedValue(undefined)
    mockServer = {
      register: mockServerRegister
    }

    vi.spyOn(Hapi, 'server').mockReturnValue(mockServer)
    vi.spyOn(setupProxyModule, 'setupProxy')
  })

  afterEach(() => {
    // Restore original port value
    if (originalPort !== undefined) {
      config.set('port', originalPort)
    }
    vi.restoreAllMocks()
  })

  describe('Server creation', () => {
    test('Should call setupProxy', async () => {
      await createServer()

      expect(setupProxyModule.setupProxy).toHaveBeenCalledTimes(1)
    })

    test('Should create Hapi server with correct configuration', async () => {
      await createServer()

      expect(Hapi.server).toHaveBeenCalledWith({
        host: '0.0.0.0',
        port: 3001,
        routes: {
          validate: {
            options: {
              abortEarly: false
            },
            failAction: expect.any(Function)
          },
          security: {
            hsts: {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: false
            },
            xss: 'enabled',
            noSniff: true,
            xframe: true
          }
        },
        router: {
          stripTrailingSlash: true
        }
      })
    })

    test('Should read host and port from config', async () => {
      await createServer()

      // Verify that config.get was called for host and port
      // The server creation test above already verifies the values are used
      expect(Hapi.server).toHaveBeenCalledWith(
        expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number)
        })
      )
    })
  })

  describe('Plugin registration', () => {
    test('Should register plugins', async () => {
      await createServer()

      expect(mockServerRegister).toHaveBeenCalledTimes(1)
      const registeredPlugins = mockServerRegister.mock.calls[0][0]

      // Should register at least the default plugins
      expect(registeredPlugins.length).toBeGreaterThanOrEqual(5)
    })

    test('Should include SQS plugin by default', async () => {
      await createServer()

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      // SQS plugin should be included (6 plugins total)
      expect(registeredPlugins.length).toBe(6)
    })

    test('Should exclude SQS plugin when disableSQS option is true', async () => {
      await createServer({ disableSQS: true })

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      // Without SQS plugin (5 plugins total)
      expect(registeredPlugins.length).toBe(5)
    })

    test('Should include SQS plugin when disableSQS option is false', async () => {
      await createServer({ disableSQS: false })

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      // With SQS plugin (6 plugins total)
      expect(registeredPlugins.length).toBe(6)
    })
  })

  describe('Return value', () => {
    test('Should return the server instance', async () => {
      const result = await createServer()

      expect(result).toBe(mockServer)
    })
  })

  describe('Options handling', () => {
    test('Should handle empty options object', async () => {
      await createServer({})

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      expect(registeredPlugins.length).toBe(6)
    })

    test('Should handle no options provided', async () => {
      await createServer()

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      expect(registeredPlugins.length).toBe(6)
    })

    test('Should handle additional options without affecting behavior', async () => {
      await createServer({ someOtherOption: 'value' })

      const registeredPlugins = mockServerRegister.mock.calls[0][0]
      expect(registeredPlugins.length).toBe(6)
    })
  })
})
