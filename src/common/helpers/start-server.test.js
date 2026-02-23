import { describe, test, expect, vi, beforeEach } from 'vitest'

import { startServer } from '#~/common/helpers/start-server.js'

const { mockConfigGetFn } = vi.hoisted(() => {
  const fn = vi.fn().mockImplementation((key) => {
    switch (key) {
      case 'port':
        return 3000
      case 'log':
        return { isEnabled: true, redact: [], level: 'info', format: 'ecs' }
      case 'serviceName':
        return 'test-service'
      case 'serviceVersion':
        return '0.0.0'
      default:
        return undefined
    }
  })
  return { mockConfigGetFn: fn }
})

vi.mock('#~/config.js', () => ({
  config: {
    get: mockConfigGetFn
  }
}))

describe('startServer', () => {
  let mockCreateServerFn
  let mockServerStartFn
  let mockServerLogger
  let mockCreateLoggerFn
  let mockLoggerInfoFn
  let mockLoggerErrorFn

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup server logger mock
    mockServerLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    // Setup server mock
    mockServerStartFn = vi.fn().mockResolvedValue(undefined)
    const mockServer = {
      start: mockServerStartFn,
      logger: mockServerLogger
    }

    // Setup createServer mock
    mockCreateServerFn = vi.fn().mockResolvedValue(mockServer)

    // Setup logger mock
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    mockCreateLoggerFn = vi.fn().mockReturnValue(mockLogger)
    mockLoggerInfoFn = mockLogger.info
    mockLoggerErrorFn = mockLogger.error
  })

  describe('When server starts successfully', () => {
    test('Should create server with options', async () => {
      const options = { disableSQS: true, createServerFn: mockCreateServerFn }
      await startServer(options)

      expect(mockCreateServerFn).toHaveBeenCalledWith({ disableSQS: true })
    })

    test('Should create server with default empty options', async () => {
      await startServer({ createServerFn: mockCreateServerFn })

      expect(mockCreateServerFn).toHaveBeenCalledWith({})
    })

    test('Should start the server', async () => {
      await startServer({ createServerFn: mockCreateServerFn })

      expect(mockServerStartFn).toHaveBeenCalled()
    })

    test('Should log success messages', async () => {
      await startServer({ createServerFn: mockCreateServerFn })

      expect(mockServerLogger.info).toHaveBeenCalledWith(
        'Server started successfully'
      )
      expect(mockConfigGetFn).toHaveBeenCalledWith('port')
      expect(mockServerLogger.info).toHaveBeenCalledWith(
        'Access your backend on http://localhost:3000'
      )
    })

    test('Should return the server instance', async () => {
      const result = await startServer({ createServerFn: mockCreateServerFn })

      expect(result).toBeDefined()
      expect(result.logger).toBe(mockServerLogger)
      expect(result.start).toBe(mockServerStartFn)
    })
  })

  describe('When server fails to start', () => {
    const mockError = new Error('Server start failed')

    beforeEach(() => {
      mockServerStartFn.mockRejectedValueOnce(mockError)
    })

    test('Should create logger when error occurs', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow(mockError)

      expect(mockCreateLoggerFn).toHaveBeenCalled()
    })

    test('Should log error messages', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow(mockError)

      expect(mockLoggerInfoFn).toHaveBeenCalledWith('Server failed to start :(')
      expect(mockLoggerErrorFn).toHaveBeenCalledWith(mockError)
    })

    test('Should rethrow the error', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow('Server start failed')
    })

    test('Should not log success messages on error', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow(mockError)

      expect(mockServerLogger.info).not.toHaveBeenCalled()
    })
  })

  describe('When createServer fails', () => {
    const mockError = new Error('Failed to create server')

    beforeEach(() => {
      mockCreateServerFn.mockRejectedValueOnce(mockError)
    })

    test('Should create logger when error occurs', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow(mockError)

      expect(mockCreateLoggerFn).toHaveBeenCalled()
    })

    test('Should log error messages', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow(mockError)

      expect(mockLoggerInfoFn).toHaveBeenCalledWith('Server failed to start :(')
      expect(mockLoggerErrorFn).toHaveBeenCalledWith(mockError)
    })

    test('Should rethrow the error', async () => {
      await expect(
        startServer({
          createServerFn: mockCreateServerFn,
          createLoggerFn: mockCreateLoggerFn
        })
      ).rejects.toThrow('Failed to create server')
    })
  })
})
