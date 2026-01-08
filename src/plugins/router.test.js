import { vi } from 'vitest'
import { router } from '~/src/plugins/router.js'

// Mock the health route
vi.mock('~/src/routes/health.js', () => ({
  health: {
    method: 'GET',
    path: '/health',
    handler: vi.fn()
  }
}))

describe('router plugin', () => {
  it('should register health route when plugin is registered', () => {
    const mockServer = {
      route: vi.fn()
    }

    router.plugin.register(mockServer, {})

    expect(mockServer.route).toHaveBeenCalledTimes(1)
    expect(mockServer.route).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: '/health'
        })
      ])
    )
  })

  it('should handle options parameter', () => {
    const mockServer = {
      route: vi.fn()
    }
    const options = { someOption: 'value' }

    router.plugin.register(mockServer, options)

    expect(mockServer.route).toHaveBeenCalled()
  })
})
