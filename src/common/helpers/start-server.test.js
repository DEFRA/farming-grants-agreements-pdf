import hapi from '@hapi/hapi'

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let startServerImport
  let createServerImport

  beforeAll(async () => {
    process.env.PORT = '3098'

    createServerImport = await import('../../server.js')
    startServerImport = await import('./start-server.js')

    createServerSpy = jest.spyOn(createServerImport, 'createServer')
    hapiServerSpy = jest.spyOn(hapi, 'server')
  })

  afterAll(() => {
    delete process.env.PORT
  })

  describe('When server starts', () => {
    test('Should start up server as expected', async () => {
      const server = await startServerImport.startServer({ disableSQS: true })

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()

      await server.stop({ timeout: 0 })
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(
        startServerImport.startServer({ disableSQS: true })
      ).rejects.toThrow('Server failed to start')
    })
  })
})
