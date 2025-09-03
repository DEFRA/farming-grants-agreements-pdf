import { handleEvent, processMessage } from './sqs-message-processor.js'
import { publishAcceptOffer } from './publish-accept-offer.js'

jest.mock('./publish-accept-offer.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    publishAcceptOffer.mockResolvedValue({
      agreementNumber: 'SFI123456789',
      correlationId: 'test-correlation-id',
      clientRef: 'test-client-ref',
      frn: 'test-frn',
      sbi: 'test-sbi',
      htmlPage: '<html><body>Test Agreement</body></html>'
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'offer.accepted',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          htmlPage: '<html><body>Test Agreement</body></html>'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

      expect(publishAcceptOffer).toHaveBeenCalledWith(
        mockPayload.data,
        mockLogger
      )
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message'),
        expect.objectContaining({
          message,
          error: expect.any(String)
        })
      )
    })

    it('should handle non-SyntaxError with Boom.boomify', async () => {
      const message = {
        Body: JSON.stringify({
          Message: JSON.stringify({ type: 'invalid.type' })
        })
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Error processing SQS message'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message'),
        expect.objectContaining({
          message,
          error: expect.any(String)
        })
      )
    })
  })

  describe('handleEvent', () => {
    it('should create agreement for offer-accepted events', async () => {
      const mockPayload = {
        type: 'offer.accepted',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          htmlPage: '<html><body>Test Agreement</body></html>'
        }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating agreement from event')
      )
      expect(publishAcceptOffer).toHaveBeenCalledWith(
        mockPayload.data,
        mockLogger
      )
    })

    it('should throw an error for non-offer-accepted events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          htmlPage: '<html><body>Test Agreement</body></html>'
        }
      }

      await expect(
        handleEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')

      expect(publishAcceptOffer).not.toHaveBeenCalled()
    })
  })
})
