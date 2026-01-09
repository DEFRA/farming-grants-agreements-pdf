import { describe, test, expect, vi, beforeEach } from 'vitest'

import { startServer } from '~/src/common/helpers/start-server.js'
import { config } from '~/src/config.js'

// Mock config at the top level using hoisted
const { mockConfigGetFn } = vi.hoisted(() => ({
  mockConfigGetFn: vi.fn().mockReturnValue(3000)
}))

vi.mock('~/src/config.js', () => ({
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

    // Reset config mock - use spyOn as fallback if mock doesn't work
    mockConfigGetFn.mockReturnValue(3000)
    vi.spyOn(config, 'get').mockImplementation(mockConfigGetFn)
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
      expect(mockServerLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^Access your backend on http:\/\/localhost:\d+$/)
      )
    })

    test('Should return the server instance', async () => {
      const result = await startServer({ createServerFn: mockCreateServerFn })

      expect(result).toBeDefined()
      expect(result.logger).toBe(mockServerLogger)
      expect(result.start).toBe(mockServerStartFn)
    })

    test('Should use port from config', async () => {
      mockConfigGetFn.mockReturnValue(8080)
      await startServer({ createServerFn: mockCreateServerFn })

      expect(mockConfigGetFn).toHaveBeenCalledWith('port')
      expect(mockServerLogger.info).toHaveBeenCalledWith(
        'Access your backend on http://localhost:8080'
      )
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
