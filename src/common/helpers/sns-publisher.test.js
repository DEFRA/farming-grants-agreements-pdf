import { publishEvent } from './sns-publisher.js'
import { PublishCommand } from '@aws-sdk/client-sns'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../../config.js'

jest.mock('@aws-sdk/client-sns')
jest.mock('uuid')
jest.mock('../../config.js', () => ({
  config: { get: jest.fn() }
}))

// Mock setTimeout to use shorter delays for faster tests
const originalSetTimeout = global.setTimeout

beforeAll(() => {
  global.setTimeout = (fn, delay) => originalSetTimeout(fn, Math.min(delay, 10))
})

afterAll(() => {
  global.setTimeout = originalSetTimeout
})

describe('publishEvent', () => {
  const mockSend = jest.fn()
  const logger = { info: jest.fn(), error: jest.fn() }

  const mockClient = { send: mockSend }

  beforeEach(() => {
    uuidv4.mockReturnValue('mock-uuid')
    jest.clearAllMocks()
    config.get.mockImplementation((key) => {
      switch (key) {
        case 'aws.region':
          return 'eu-west-2'
        case 'aws.sns.endpoint':
          return 'http://localhost:4566'
        case 'aws.accessKeyId':
          return 'test-access-key'
        case 'aws.secretAccessKey':
          return 'test-secret-key'
        case 'aws.sns.eventSource':
          return 'test-source'
        case 'aws.sns.maxAttempts':
          return 3
        default:
          return undefined
      }
    })
  })

  it('publishes a message successfully', async () => {
    mockSend.mockResolvedValueOnce({})

    await publishEvent(
      {
        topicArn: 'arn:aws:sns:eu-west-2:123456789012:test-topic',
        type: 'TestType',
        time: '2025-08-12T14:34:38+01:00',
        data: { foo: 'bar' }
      },
      logger,
      mockClient
    )

    expect(mockSend).toHaveBeenCalledWith(expect.any(PublishCommand))
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Published event to SNS topic')
    )
  })

  it('retries on retryable error and succeeds', async () => {
    mockSend
      .mockRejectedValueOnce({
        $metadata: { httpStatusCode: 500 },
        name: 'InternalError',
        message: 'fail'
      })
      .mockResolvedValueOnce({})

    await publishEvent(
      {
        topicArn: 'arn:aws:sns:eu-west-2:123456789012:test-topic',
        type: 'TestType',
        time: '2025-08-12T14:34:38+01:00',
        data: { foo: 'bar' }
      },
      logger,
      mockClient
    )

    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish event to SNS',
      expect.objectContaining({
        attempt: 1,
        error: 'fail',
        code: 'InternalError'
      })
    )
    expect(logger.info).toHaveBeenCalled()
  })

  it('throws after max retries on persistent error', async () => {
    mockSend.mockRejectedValue({
      $metadata: { httpStatusCode: 500 },
      name: 'InternalError',
      message: 'fail'
    })

    await expect(
      publishEvent(
        {
          topicArn: 'arn:aws:sns:eu-west-2:123456789012:test-topic',
          type: 'TestType',
          time: '2025-08-12T14:34:38+01:00',
          data: { foo: 'bar' }
        },
        logger,
        mockClient
      )
    ).rejects.toMatchObject({
      name: 'InternalError',
      message: 'fail'
    })

    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(logger.error).toHaveBeenCalled()
  })

  it('does not retry on real error', async () => {
    mockSend.mockRejectedValueOnce({
      $metadata: { httpStatusCode: 400 },
      name: 'BadRequest',
      message: 'bad request'
    })

    await expect(
      publishEvent(
        {
          topicArn: 'arn:aws:sns:eu-west-2:123456789012:test-topic',
          type: 'TestType',
          time: '2025-08-12T14:34:38+01:00',
          data: { foo: 'bar' }
        },
        logger,
        mockClient
      )
    ).rejects.toMatchObject({
      name: 'BadRequest',
      message: 'bad request'
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to publish event to SNS',
      expect.objectContaining({
        attempt: 1,
        error: 'bad request',
        code: 'BadRequest'
      })
    )
  })
})
