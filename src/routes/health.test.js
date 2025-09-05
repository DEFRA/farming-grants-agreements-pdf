import { health } from './health.js'

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
        response: jest.fn().mockReturnThis()
      }
    })

    test('should return success message', () => {
      const result = health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ message: 'success' })
      expect(result).toBe(mockH)
    })

    test('should not use request parameter', () => {
      health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ message: 'success' })
    })

    test('should return response with correct structure', () => {
      health.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall).toEqual({ message: 'success' })
      expect(Object.keys(responseCall)).toEqual(['message'])
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

        expect(mockH.response).toHaveBeenCalledWith({ message: 'success' })
      })
    })

    test('should always return the same response', () => {
      const result1 = health.handler(mockRequest, mockH)
      mockH.response.mockClear()
      const result2 = health.handler({ different: 'request' }, mockH)

      expect(mockH.response).toHaveBeenCalledTimes(1)
      expect(mockH.response).toHaveBeenCalledWith({ message: 'success' })
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
