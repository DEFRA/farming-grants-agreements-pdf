import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'
import { sqsClientPlugin } from './sqs-client.js'
import { publishAcceptOffer } from './publish-accept-offer.js'

// Mock AWS SDK credential provider
jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => () =>
    Promise.resolve({
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
}))

jest.mock('./publish-accept-offer.js')
jest.mock('@aws-sdk/client-sqs')
jest.mock('sqs-consumer')
jest.mock('../../config.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'sqs.maxMessages':
          return 10
        case 'sqs.waitTime':
          return 5
        case 'sqs.visibilityTimeout':
          return 30
        case 'featureFlags.seedDb':
          return true
        default:
          return undefined
      }
    })
  }
}))

describe('SQS Client', () => {
  let server
  let mockSqsClient
  let mockLogger
  let mockConsumer

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    }

    // Setup SQS client mock
    mockSqsClient = {
      send: jest.fn(),
      destroy: jest.fn()
    }
    SQSClient.mockImplementation(() => mockSqsClient)

    // Setup server mock
    server = {
      logger: mockLogger,
      events: {
        on: jest.fn(),
        emit: jest.fn()
      }
    }

    // Setup Consumer mock
    mockConsumer = {
      start: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }
    Consumer.create = jest.fn().mockReturnValue(mockConsumer)

    // Setup publishAcceptOffer mock to return a mock agreement
    publishAcceptOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789',
      notificationMessageId: 'test-message-id',
      frn: '123456789',
      sbi: '123456789'
    })
  })

  afterEach(() => {
    jest.resetModules()
  })

  describe('sqsClientPlugin', () => {
    const options = {
      awsRegion: 'us-east-1',
      sqsEndpoint: 'http://localhost:4566',
      queueUrl: 'test-queue-url'
    }

    it('should initialize properly when registered', () => {
      sqsClientPlugin.plugin.register(server, options)

      // Check SQS client was created
      expect(SQSClient).toHaveBeenCalledWith({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      // Check Consumer was created with correct options
      expect(Consumer.create).toHaveBeenCalledWith({
        queueUrl: options.queueUrl,
        handleMessage: expect.any(Function),
        sqs: mockSqsClient,
        batchSize: 10,
        waitTimeSeconds: 5,
        visibilityTimeout: 30,
        handleMessageTimeout: 30000,
        attributeNames: ['All'],
        messageAttributeNames: ['All']
      })

      // Check error handlers were set up
      expect(mockConsumer.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )
      expect(mockConsumer.on).toHaveBeenCalledWith(
        'processing_error',
        expect.any(Function)
      )

      // Check consumer was started
      expect(mockConsumer.start).toHaveBeenCalled()

      // Check stop handler was set up
      expect(server.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )
    })

    it('should handle plugin cleanup on server stop', async () => {
      sqsClientPlugin.plugin.register(server, options)

      // Get and call the stop handler
      const stopHandler = server.events.on.mock.calls.find(
        (call) => call[0] === 'stop'
      )[1]
      await stopHandler()

      // Check cleanup was performed
      expect(mockConsumer.stop).toHaveBeenCalled()
      expect(mockSqsClient.destroy).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stopping SQS consumer')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Closing SQS client')
      )
    })

    it('should handle message processing errors', async () => {
      sqsClientPlugin.plugin.register(server, options)

      // Get the message handler
      const messageHandler = Consumer.create.mock.calls[0][0].handleMessage

      // Call handler with invalid message
      const invalidMessage = {
        Body: 'invalid json',
        MessageId: 'msg-1'
      }

      await messageHandler(invalidMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message:',
        expect.objectContaining({
          messageId: 'msg-1'
        })
      )
    })

    it('should handle consumer errors', () => {
      sqsClientPlugin.plugin.register(server, options)

      // Get the error handler
      const errorHandler = mockConsumer.on.mock.calls.find(
        (call) => call[0] === 'error'
      )[1]

      // Call error handler
      const error = new Error('Consumer error')
      errorHandler(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SQS Consumer error:',
        expect.objectContaining({
          error: error.message
        })
      )
    })

    it('should handle processing errors', () => {
      sqsClientPlugin.plugin.register(server, options)

      // Get the processing error handler
      const errorHandler = mockConsumer.on.mock.calls.find(
        (call) => call[0] === 'processing_error'
      )[1]

      // Call error handler
      const error = new Error('Processing error')
      errorHandler(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SQS Message processing error:',
        expect.objectContaining({
          error: error.message
        })
      )
    })
  })
})
