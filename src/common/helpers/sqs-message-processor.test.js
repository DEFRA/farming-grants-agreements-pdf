import { handleEvent, processMessage } from './sqs-message-processor.js'
import { generatePdf } from '../../services/pdf-generator.js'

jest.mock('../../services/pdf-generator.js')

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = { info: jest.fn(), error: jest.fn() }
    generatePdf.mockResolvedValue('/path/to/generated.pdf')
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
        expect.stringContaining('Processing agreement offer from event')
      )
      expect(generatePdf).toHaveBeenCalledWith(
        '<html><body>Test Agreement</body></html>',
        'agreement-SFI123456789.pdf',
        mockLogger
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          agreementNumber: 'SFI123456789',
          filename: 'agreement-SFI123456789.pdf'
        },
        'Generating PDF from HTML content'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          pdfPath: '/path/to/generated.pdf',
          filename: 'agreement-SFI123456789.pdf'
        },
        'PDF generated successfully'
      )
    })

    it('should create agreement and handle PDF generation for offer-accepted events with agreementNumber', async () => {
      const mockPayload = {
        type: 'offer.accepted',
        data: {
          agreementNumber: 'AGR-789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          htmlPage: '<html><body>Test Agreement</body></html>'
        }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(generatePdf).toHaveBeenCalledWith(
        '<html><body>Test Agreement</body></html>',
        'agreement-AGR-789.pdf',
        mockLogger
      )
    })

    it('should create agreement but skip PDF generation when htmlPage is missing', async () => {
      const mockPayload = {
        type: 'offer.accepted',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi'
        }
      }

      await handleEvent('aws-message-id', mockPayload, mockLogger)
      expect(generatePdf).not.toHaveBeenCalled()
    })

    it('should handle PDF generation errors without breaking agreement creation', async () => {
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
          htmlPage: '<html><body>Test Agreement</body></html>'
        }
      }

      // Should not throw - PDF generation failure doesn't break agreement creation
      await handleEvent('aws-message-id', mockPayload, mockLogger)
      expect(generatePdf).toHaveBeenCalledWith(
        '<html><body>Test Agreement</body></html>',
        'agreement-SFI123456789.pdf',
        mockLogger
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: pdfError, agreementNumber: 'SFI123456789' },
        'Failed to generate PDF'
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
    })
  })
})
