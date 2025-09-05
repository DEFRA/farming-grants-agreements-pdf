import hapi from '@hapi/hapi'

const mockLoggerInfo = jest.fn()
const mockLoggerWarn = jest.fn()
const mockLoggerError = jest.fn()

const mockHapiLoggerInfo = jest.fn()
const mockHapiLoggerWarn = jest.fn()
const mockHapiLoggerError = jest.fn()

jest.mock('hapi-pino', () => ({
  register: (server) => {
    server.decorate('server', 'logger', {
      info: mockHapiLoggerInfo,
      warn: mockHapiLoggerWarn,
      error: mockHapiLoggerError
    })
  },
  name: 'mock-hapi-pino'
}))
jest.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({
    info: (...args) => mockLoggerInfo(...args),
    warn: (...args) => mockLoggerWarn(...args),
    error: (...args) => mockLoggerError(...args)
  })
}))

describe('#startServer', () => {
  const PROCESS_ENV = process.env
  let createServerSpy
  let hapiServerSpy
  let startServerImport
  let createServerImport

  beforeAll(async () => {
    process.env = { ...PROCESS_ENV }
    process.env.PORT = '3098' // Set to obscure port to avoid conflicts

    createServerImport = await import('../../server.js')
    startServerImport = await import('./start-server.js')

    createServerSpy = jest.spyOn(createServerImport, 'createServer')
    hapiServerSpy = jest.spyOn(hapi, 'server')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = PROCESS_ENV
    createServerSpy?.mockRestore()
    hapiServerSpy?.mockRestore()
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      if (server && server.stop) {
        await server.stop({ timeout: 0 })
      }
    })

    test('Should start up server as expected', async () => {
      server = await startServerImport.startServer({ disableSQS: true })

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Found 0 CA Certs to install'
      )
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Server started successfully'
      )
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Access your backend on http://localhost:3098'
      )
    })
  })

  describe('When server start fails', () => {
    beforeEach(() => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))
    })

    afterEach(() => {
      createServerSpy.mockRestore()
      createServerSpy = jest.spyOn(createServerImport, 'createServer')
    })

    test('Should log failed startup message', async () => {
      try {
        await startServerImport.startServer({ disableSQS: true })
      } catch (error) {
        // Expected to throw
      }

      expect(mockLoggerInfo).toHaveBeenCalledWith('Server failed to start :(')
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Server failed to start'
        })
      )
    })
  })
})
