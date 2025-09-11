import { handleEvent, processMessage } from './sqs-message-processor.js'
import { generatePdf } from '../../services/pdf-generator.js'
import { uploadPdf } from '../../services/file-upload.js'

jest.mock('../../services/pdf-generator.js')
jest.mock('../../services/file-upload.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() }
    generatePdf.mockResolvedValue('/path/to/generated.pdf')
    uploadPdf.mockResolvedValue({ success: true })
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
    it('should generate PDF for agreement and upload it to S3', async () => {
      const mockPayload = {
        type: 'offer.accepted',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
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
        type: 'offer.accepted',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
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
        expect.stringContaining(
          'Failed to generate agreement SFI123456789-1 PDF. Error: Error: PDF generation failed'
        )
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
          agreementUrl: 'https://example.com/agreement/SFI123456789'
        }
      }

      await expect(
        handleEvent('aws-message-id', mockPayload, mockLogger)
      ).rejects.toThrow('Unrecognized event type')
    })
  })
})
