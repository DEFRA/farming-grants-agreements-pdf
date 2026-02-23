import { vi } from 'vitest'
import { StorageResolution, Unit } from 'aws-embedded-metrics'

import { metricsCounter } from '#~/common/helpers/metrics.js'
import { config } from '#~/config.js'

// Use hoisted mocks
const { mockPutMetric, mockFlush, mockLoggerErrorFn } = vi.hoisted(() => ({
  mockPutMetric: vi.fn(),
  mockFlush: vi.fn(),
  mockLoggerErrorFn: vi.fn()
}))

vi.mock('aws-embedded-metrics', () => ({
  createMetricsLogger: () => ({
    putMetric: mockPutMetric,
    flush: mockFlush
  }),
  StorageResolution: { Standard: 'Standard' },
  Unit: { Count: 'Count' }
}))

vi.mock('#~/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: mockLoggerErrorFn })
}))

const mockMetricsName = 'mock-metrics-name'
const defaultMetricsValue = 1
const mockValue = 200

describe('#metrics', () => {
  describe('When metrics is not enabled', () => {
    beforeEach(async () => {
      config.set('isMetricsEnabled', false)
      await metricsCounter(mockMetricsName, mockValue)
    })

    test('Should not call metric', () => {
      expect(mockPutMetric).not.toHaveBeenCalled()
    })

    test('Should not call flush', () => {
      expect(mockFlush).not.toHaveBeenCalled()
    })
  })

  describe('When metrics is enabled', () => {
    beforeEach(() => {
      config.set('isMetricsEnabled', true)
    })

    test('Should send metric with default value', async () => {
      await metricsCounter(mockMetricsName)

      expect(mockPutMetric).toHaveBeenCalledWith(
        mockMetricsName,
        defaultMetricsValue,
        Unit.Count,
        StorageResolution.Standard
      )
    })

    test('Should send metric', async () => {
      await metricsCounter(mockMetricsName, mockValue)

      expect(mockPutMetric).toHaveBeenCalledWith(
        mockMetricsName,
        mockValue,
        Unit.Count,
        StorageResolution.Standard
      )
    })

    test('Should not call flush', async () => {
      await metricsCounter(mockMetricsName, mockValue)
      expect(mockFlush).toHaveBeenCalled()
    })
  })

  describe('When metrics throws', () => {
    const mockError = 'mock-metrics-put-error'

    beforeEach(async () => {
      config.set('isMetricsEnabled', true)
      mockFlush.mockRejectedValue(new Error(mockError))

      await metricsCounter(mockMetricsName, mockValue)
    })

    test('Should log expected error', () => {
      expect(mockFlush).toHaveBeenCalled()
    })
  })
})
