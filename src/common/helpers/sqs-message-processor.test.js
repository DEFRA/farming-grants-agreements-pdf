import { handleEvent, processMessage } from './sqs-message-processor.js'
import { generatePdf } from '../../services/pdf-generator.js'
import { uploadPdf } from '../../services/file-upload.js'

jest.mock('../../services/pdf-generator.js')
jest.mock('../../services/file-upload.js')
jest.mock('../../config.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'allowedDomains':
          return 'example.com'
        default:
          return undefined
      }
    })
  }
}))

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    }
    generatePdf.mockResolvedValue('/path/to/generated.pdf')
    uploadPdf.mockResolvedValue({ success: true })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)
    })

    it('should handle invalid JSON in message body', async () => {
      const message = {
        Body: 'invalid json'
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Error processing message'
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
        expect.any(Error),
        'Error processing message'
      )
    })
  })

  describe('handleEvent', () => {
    it('should generate PDF for agreement and upload it to S3', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing agreement offer from event')
      )
      expect(generatePdf).toHaveBeenCalledWith(
        mockPayload.data,
        'SFI123456789-1.pdf',
        mockLogger
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Generating Agreement SFI123456789-1 PDF from agreement URL https://example.com/agreement/SFI123456789'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'PDF SFI123456789-1.pdf generated successfully and save to /path/to/generated.pdf'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Agreement SFI123456789 PDF uploaded successfully (true) to S3'
        )
      )
    })

    it('should handle PDF generation errors', async () => {
      const pdfError = new Error('PDF generation failed')
      generatePdf.mockRejectedValue(pdfError)

      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }

      // Should not throw - PDF generation failure doesn't break agreement creation
      await handleEvent('aws-message-id', mockPayload, mockLogger)
      expect(generatePdf).toHaveBeenCalledWith(
        mockPayload.data,
        'SFI123456789-1.pdf',
        mockLogger
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF generation failed'
        }),
        'Failed to generate agreement SFI123456789-1 PDF from URL https://example.com/agreement/SFI123456789'
      )
    })

    it('should skip PDF generation when status is not accepted', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'offered',
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(result).toBe('')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping PDF generation for status: offered'
      )
      expect(generatePdf).not.toHaveBeenCalled()
      expect(uploadPdf).not.toHaveBeenCalled()
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
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }

      await expect(
        handleEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')
    })

    it('should skip PDF generation when URL domain is not allowed', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://bad-domain.com/agreement/SFI123456789'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(result).toBe('')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping PDF generation for URL: https://bad-domain.com/agreement/SFI123456789 domain is not on allow list'
      )
      expect(generatePdf).not.toHaveBeenCalled()
      expect(uploadPdf).not.toHaveBeenCalled()
    })
  })
})
