import { vi } from 'vitest'

// Use vi.hoisted() to set up mocks before other mocks
const { mockEcsFormatFn, mockGetTraceIdFn, mockConfig } = vi.hoisted(() => {
  const defaultConfigData = {
    log: {
      isEnabled: false, // Default for test environment
      level: 'info',
      format: 'pino-pretty', // Default for non-production
      redact: ['req', 'res', 'responseTime'] // Default for non-production
    },
    serviceName: 'farming-grants-agreements-pdf',
    serviceVersion: '1.0.0'
  }

  // Mutable config store that can be updated by set() and read by get()
  const store = JSON.parse(JSON.stringify(defaultConfigData))

  const configGetFn = (key) => {
    // Handle nested keys like 'log.isEnabled'
    const keys = key.split('.')
    let value = store
    for (const k of keys) {
      value = value?.[k]
    }
    return value
  }

  const configSetFn = (key, value) => {
    // Handle nested keys like 'log.format'
    const keys = key.split('.')
    if (keys.length === 1) {
      store[key] = value
    } else {
      let target = store
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) {
          target[keys[i]] = {}
        }
        target = target[keys[i]]
      }
      target[keys[keys.length - 1]] = value
    }
  }

  return {
    mockEcsFormatFn: vi.fn(() => ({
      formatters: {
        level: vi.fn(),
        log: vi.fn()
      },
      messageKey: 'message',
      timestamp: vi.fn()
    })),
    mockGetTraceIdFn: vi.fn(),
    mockConfig: {
      get: configGetFn,
      set: configSetFn
    }
  }
})

const mockEcsFormat = mockEcsFormatFn
const mockGetTraceId = mockGetTraceIdFn

vi.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: mockEcsFormat
}))

vi.mock('~/src/config.js', () => ({
  config: mockConfig
}))

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: mockGetTraceId
}))

describe('loggerOptions', () => {
  let loggerOptions
  let config

  beforeAll(async () => {
    // Import the module after mocks are set up
    const module = await import(
      '~/src/common/helpers/logging/logger-options.js'
    )
    loggerOptions = module.loggerOptions
    const configModule = await import('~/src/config.js')
    config = configModule.config
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset config store to defaults using config.set()
    config.set('log.isEnabled', false)
    config.set('log.level', 'info')
    config.set('log.format', 'pino-pretty')
    config.set('log.redact', ['req', 'res', 'responseTime'])
    config.set('serviceName', 'farming-grants-agreements-pdf')
    config.set('serviceVersion', '1.0.0')

    mockEcsFormat.mockReturnValue({
      formatters: {
        level: vi.fn(),
        log: vi.fn()
      },
      messageKey: 'message',
      timestamp: vi.fn()
    })
  })

  describe('basic configuration', () => {
    test('should have correct enabled setting', () => {
      // In test environment (NODE_ENV=test), isEnabled defaults to false
      // The getter reads from config.get('log.isEnabled') which uses actual config
      expect(loggerOptions.enabled).toBe(false)
    })

    test('should have correct ignorePaths', () => {
      expect(loggerOptions.ignorePaths).toEqual(['/health'])
    })

    test('should have correct redact configuration', () => {
      // In test environment (non-production), redact defaults to ['req', 'res', 'responseTime']
      // The getter reads from config.get('log.redact') which uses actual config
      expect(loggerOptions.redact).toEqual({
        paths: ['req', 'res', 'responseTime'],
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
