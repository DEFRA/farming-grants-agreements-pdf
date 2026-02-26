import { vi } from 'vitest'
import { health } from '#~/routes/health.js'
import { config } from '#~/config.js'

describe('health route', () => {
  describe('route configuration', () => {
    test('should have correct method', () => {
      expect(health.method).toBe('GET')
    })

    test('should have correct path', () => {
      expect(health.path).toBe('/health')
    })

    test('should have a handler function', () => {
      expect(typeof health.handler).toBe('function')
    })
  })

  describe('handler', () => {
    let mockRequest
    let mockH

    beforeEach(() => {
      mockRequest = {}
      mockH = {
        response: vi.fn().mockReturnThis()
      }
      config.set('serviceVersion', 'versionMock')
    })

    test('should return success message', () => {
      const result = health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        version: 'versionMock'
      })
      expect(result).toBe(mockH)
    })

    test('should not use request parameter', () => {
      health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        version: 'versionMock'
      })
    })

    test('should return response with correct structure', () => {
      health.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall).toEqual({
        message: 'success',
        version: 'versionMock'
      })
      expect(Object.keys(responseCall)).toEqual(['message', 'version'])
    })

    test('should work with different request objects', () => {
      const requests = [
        {},
        { params: { id: '123' } },
        { query: { filter: 'test' } },
        { payload: { data: 'something' } },
        null,
        undefined
      ]

      requests.forEach((request) => {
        mockH.response.mockClear()

        health.handler(request, mockH)

        expect(mockH.response).toHaveBeenCalledWith({
          message: 'success',
          version: 'versionMock'
        })
      })
    })

    test('should always return the same response', () => {
      const result1 = health.handler(mockRequest, mockH)
      mockH.response.mockClear()
      const result2 = health.handler({ different: 'request' }, mockH)

      expect(mockH.response).toHaveBeenCalledTimes(1)
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        version: 'versionMock'
      })
      expect(result1).toBe(mockH)
      expect(result2).toBe(mockH)
    })

    test('falls back to dev version when version is not set', async () => {
      config.set('serviceVersion', null)
      const result1 = health.handler(mockRequest, mockH)
      mockH.response.mockClear()
      const result2 = health.handler({ different: 'request' }, mockH)

      expect(mockH.response).toHaveBeenCalledTimes(1)
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        version: 'dev'
      })
      expect(result1).toBe(mockH)
      expect(result2).toBe(mockH)
    })
  })

  describe('integration', () => {
    test('should be a valid Hapi route configuration', () => {
      expect(health).toEqual({
        method: 'GET',
        path: '/health',
        handler: expect.any(Function)
      })
    })

    test('should have all required Hapi route properties', () => {
      const requiredProperties = ['method', 'path', 'handler']

      requiredProperties.forEach((prop) => {
        expect(health).toHaveProperty(prop)
        expect(health[prop]).toBeDefined()
      })
    })

    test('should not have unexpected properties', () => {
      const allowedProperties = ['method', 'path', 'handler']
      const actualProperties = Object.keys(health)

      actualProperties.forEach((prop) => {
        expect(allowedProperties).toContain(prop)
      })
    })
  })
})
