import { vi } from 'vitest'

// Import after mocks are set up
import { processMessage } from '#~/common/helpers/sqs-message-processor.js'

// Use vi.hoisted() to ensure mock functions are available before mock factories run
const { mockGeneratePdfFn, mockUploadPdfFn, mockConfigGetFn } = vi.hoisted(
  () => {
    const configFn = vi.fn((key) => {
      switch (key) {
        case 'allowedDomains':
          return ['example.com']
        default:
          return undefined
      }
    })
    return {
      mockGeneratePdfFn: vi.fn(),
      mockUploadPdfFn: vi.fn(),
      mockConfigGetFn: configFn
    }
  }
)

vi.mock('#~/services/pdf-generator.js', () => ({
  generatePdf: mockGeneratePdfFn
}))

vi.mock('#~/services/file-upload.js', () => ({
  uploadPdf: mockUploadPdfFn
}))

vi.mock('#~/config.js', () => ({
  config: {
    get: mockConfigGetFn
  }
}))

describe('SQS message processor', () => {
  let mockLogger

  beforeEach(() => {
    // Clear call history first
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    // Re-apply mock implementations after clearing
    // Ensure allowedDomains is always returned for domain checks
    mockConfigGetFn.mockImplementation((key) => {
      switch (key) {
        case 'allowedDomains':
          return ['example.com', 'test.example.com']
        default:
          return undefined
      }
    })
    mockGeneratePdfFn.mockResolvedValue('/path/to/generated.pdf')
    mockUploadPdfFn.mockResolvedValue({
      success: true,
      bucket: 'test-bucket',
      key: 'test-key',
      etag: 'test-etag',
      location: 's3://test-bucket/test-key'
    })
  })

  describe('processMessage', () => {
    it('should process valid SNS message', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          agreementUrl: 'https://example.com/agreement/FPTT123456789'
        }
      }
      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing payload:',
        expect.any(String)
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing agreement offer from event')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping PDF generation for status:')
      )
      expect(mockGeneratePdfFn).not.toHaveBeenCalled()
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

    it('should unwrap and process SNS-wrapped message correctly', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          endDate: '2027-12-31'
        }
      }

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-id',
        TopicArn: 'arn:aws:sns:eu-west-2:000000000000:test-topic',
        Message: JSON.stringify(mockPayload),
        Timestamp: '2023-01-01T00:00:00.000Z'
      }

      const message = {
        MessageId: 'aws-sqs-message-id',
        Body: JSON.stringify(snsMessage)
      }

      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing payload:',
        JSON.stringify(mockPayload)
      )
      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-1.pdf',
        mockLogger
      )
    })

    it('should process raw message (non-SNS) without unwrapping', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          endDate: '2027-12-31'
        }
      }

      const message = {
        MessageId: 'aws-sqs-message-id',
        Body: JSON.stringify(mockPayload)
      }

      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing payload:',
        JSON.stringify(mockPayload)
      )
      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-1.pdf',
        mockLogger
      )
    })

    it('should handle SNS message without Message field', async () => {
      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-id',
        TopicArn: 'arn:aws:sns:eu-west-2:000000000000:test-topic',
        Timestamp: '2023-01-01T00:00:00.000Z'
      }

      const message = {
        MessageId: 'aws-sqs-message-id',
        Body: JSON.stringify(snsMessage)
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Error processing SQS message'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Error processing message'
      )
    })

    it('should handle SNS message with malformed JSON in Message field', async () => {
      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-id',
        TopicArn: 'arn:aws:sns:eu-west-2:000000000000:test-topic',
        Message: 'not valid json',
        Timestamp: '2023-01-01T00:00:00.000Z'
      }

      const message = {
        MessageId: 'aws-sqs-message-id',
        Body: JSON.stringify(snsMessage)
      }

      await expect(processMessage(message, mockLogger)).rejects.toThrow(
        'Invalid message format'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Error processing message'
      )
    })
  })

  describe('handleEvent internal flow', () => {
    it('should successfully generate and upload PDF for an accepted agreement', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          endDate: '2027-12-31'
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing agreement offer from event')
      )

      // Config mock is working - verify generatePdf was called
      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-1.pdf',
        mockLogger
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Generating Agreement FPTT123456789-1 PDF from agreement URL https://example.com/agreement/FPTT123456789'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'PDF FPTT123456789-1.pdf generated successfully and save to /path/to/generated.pdf'
        )
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Agreement FPTT123456789 PDF uploaded successfully (true) to S3'
        )
      )

      expect(mockUploadPdfFn).toHaveBeenCalledWith(
        '/path/to/generated.pdf',
        'FPTT123456789-1.pdf',
        'FPTT123456789',
        1,
        '2027-12-31',
        mockLogger,
        {
          correlationId: 'test-correlation-id',
          accounts: { sbi: 'test-sbi', frn: 'test-frn', crn: undefined }
        }
      )
    })

    it('should handle PDF generation errors gracefully', async () => {
      const pdfError = new Error('PDF generation failed')
      mockGeneratePdfFn.mockRejectedValueOnce(pdfError)

      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789'
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-1.pdf',
        mockLogger
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        pdfError,
        'Failed to generate agreement FPTT123456789-1 PDF from URL https://example.com/agreement/FPTT123456789'
      )
    })

    it('should skip PDF generation when status is not accepted', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'offered',
          agreementUrl: 'https://example.com/agreement/FPTT123456789'
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping PDF generation for status: offered'
      )
      expect(mockGeneratePdfFn).not.toHaveBeenCalled()
      expect(mockUploadPdfFn).not.toHaveBeenCalled()
    })

    it('should throw an error for non-offer-accepted events', async () => {
      const mockPayload = {
        type: 'some-other-event',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          agreementUrl: 'https://example.com/agreement/FPTT123456789'
        }
      }

      let error
      try {
        const message = {
          MessageId: 'aws-message-id',
          Body: JSON.stringify(mockPayload)
        }
        await processMessage(message, mockLogger)
        expect.fail('Expected error to be thrown')
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe(
        'Error processing SQS message: Unrecognized event type'
      )
      expect(error.output.payload.message).toBe(
        'An internal server error occurred'
      )
      expect(mockGeneratePdfFn).not.toHaveBeenCalled()
      expect(mockUploadPdfFn).not.toHaveBeenCalled()
    })

    it('should skip PDF generation when URL domain is not allowed', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://bad-domain.com/agreement/FPTT123456789'
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping PDF generation for URL: https://bad-domain.com/agreement/FPTT123456789 domain is not on allow list'
      )
      expect(mockGeneratePdfFn).not.toHaveBeenCalled()
      expect(mockUploadPdfFn).not.toHaveBeenCalled()
    })

    it('should skip PDF generation when agreementUrl is missing', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted'
          // agreementUrl is missing
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockGeneratePdfFn).not.toHaveBeenCalled()
      expect(mockUploadPdfFn).not.toHaveBeenCalled()
    })

    it('should handle upload errors gracefully', async () => {
      const uploadError = new Error('S3 upload failed')
      mockUploadPdfFn.mockRejectedValueOnce(uploadError)

      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          endDate: '2027-01-01'
        }
      }

      const message = {
        MessageId: 'aws-message-id',
        Body: JSON.stringify(mockPayload)
      }
      await processMessage(message, mockLogger)

      expect(mockLogger.error).toHaveBeenCalledWith(
        uploadError,
        'Failed to upload agreement FPTT123456789 PDF /path/to/generated.pdf to S3'
      )
      // Should not log success message when upload fails
      const successCalls = mockLogger.info.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('uploaded successfully')
      )
      expect(successCalls.length).toBe(0)
    })
  })
})
