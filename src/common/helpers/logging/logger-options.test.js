const mockEcsFormat = jest.fn()
const mockGetTraceId = jest.fn()
const mockConfig = {
  get: jest.fn()
}

jest.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: mockEcsFormat
}))

jest.mock('../../../config.js', () => ({
  config: mockConfig
}))

jest.mock('@defra/hapi-tracing', () => ({
  getTraceId: mockGetTraceId
}))

describe('loggerOptions', () => {
  let loggerOptions

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    // Set up default mock returns
    mockConfig.get.mockImplementation((key) => {
      const config = {
        log: {
          isEnabled: true,
          level: 'info',
          format: 'ecs',
          redact: ['req.headers.authorization', 'req.headers.cookie']
        },
        serviceName: 'farming-grants-agreements-pdf',
        serviceVersion: '1.0.0'
      }

      const keys = key.split('.')
      let value = config
      for (const k of keys) {
        value = value?.[k]
      }
      return value
    })

    mockEcsFormat.mockReturnValue({
      formatters: {
        level: jest.fn(),
        log: jest.fn()
      },
      messageKey: 'message',
      timestamp: jest.fn()
    })

    // Import the module after mocks are set up
    const module = require('./logger-options.js')
    loggerOptions = module.loggerOptions
  })

  describe('basic configuration', () => {
    test('should have correct enabled setting', () => {
      expect(loggerOptions.enabled).toBe(true)
    })

    test('should have correct ignorePaths', () => {
      expect(loggerOptions.ignorePaths).toEqual(['/health'])
    })

    test('should have correct redact configuration', () => {
      expect(loggerOptions.redact).toEqual({
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true
      })
    })

    test('should have correct log level', () => {
      expect(loggerOptions.level).toBe('info')
    })

    test('should have nesting enabled', () => {
      expect(loggerOptions.nesting).toBe(true)
    })
  })

  describe('mixin function', () => {
    test('should return empty object when no trace ID', () => {
      mockGetTraceId.mockReturnValue(null)

      const result = loggerOptions.mixin()

      expect(result).toEqual({})
      expect(mockGetTraceId).toHaveBeenCalled()
    })

    test('should return trace ID when available', () => {
      const traceId = 'test-trace-id-123'
      mockGetTraceId.mockReturnValue(traceId)

      const result = loggerOptions.mixin()

      expect(result).toEqual({
        trace: { id: traceId }
      })
      expect(mockGetTraceId).toHaveBeenCalled()
    })

    test('should return empty object when trace ID is undefined', () => {
      mockGetTraceId.mockReturnValue(undefined)

      const result = loggerOptions.mixin()

      expect(result).toEqual({})
    })

    test('should return empty object when trace ID is empty string', () => {
      mockGetTraceId.mockReturnValue('')

      const result = loggerOptions.mixin()

      expect(result).toEqual({})
    })

    test('should handle trace ID with whitespace', () => {
      const traceId = '  trace-with-spaces  '
      mockGetTraceId.mockReturnValue(traceId)

      const result = loggerOptions.mixin()

      expect(result).toEqual({
        trace: { id: traceId }
      })
    })
  })
})
