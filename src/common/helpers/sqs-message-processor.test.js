import { vi } from 'vitest'

// Use vi.hoisted() to ensure mock functions are available before mock factories run
const { mockGeneratePdfFn, mockUploadPdfFn } = vi.hoisted(() => ({
  mockGeneratePdfFn: vi.fn(),
  mockUploadPdfFn: vi.fn()
}))

vi.mock('~/src/services/pdf-generator.js', () => ({
  generatePdf: mockGeneratePdfFn
}))

vi.mock('~/src/services/file-upload.js', () => ({
  uploadPdf: mockUploadPdfFn
}))

describe('SQS message processor', () => {
  let mockLogger
  let handleEvent
  let processMessage

  beforeEach(() => {
    // Clear call history first
    vi.clearAllMocks()

    process.env.ALLOWED_DOMAINS = 'example.com,test.example.com'

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockGeneratePdfFn.mockResolvedValue('/path/to/generated.pdf')
    mockUploadPdfFn.mockResolvedValue({
      success: true,
      bucket: 'test-bucket',
      key: 'test-key',
      etag: 'test-etag',
      location: 's3://test-bucket/test-key'
    })
  })

  beforeEach(async () => {
    vi.resetModules()
    ;({ handleEvent, processMessage } = await import(
      '~/src/common/helpers/sqs-message-processor.js'
    ))
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
        'Processing message body:',
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
  })

  describe('handleEvent', () => {
    it('should generate PDF for agreement and upload it to S3', async () => {
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

      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing agreement offer from event')
      )

      // Verify generatePdf was called
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
    })

    it('should handle PDF generation errors', async () => {
      const pdfError = new Error('PDF generation failed')
      mockGeneratePdfFn.mockRejectedValue(pdfError)

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

      // Should not throw - PDF generation failure doesn't break agreement creation
      await handleEvent('aws-message-id', mockPayload, mockLogger)

      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-1.pdf',
        mockLogger
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF generation failed'
        }),
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

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(result).toBe('')
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
        await handleEvent('aws-message-id', mockPayload, mockLogger)
        expect.fail('Expected error to be thrown')
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Unrecognized event type')
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

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(result).toBe('')
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

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      expect(result).toBe('')
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
          agreementEndDate: '2027-01-01'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      // Should return the PDF path even if upload fails (upload errors are caught)
      expect(result).toBe('/path/to/generated.pdf')
      expect(mockGeneratePdfFn).toHaveBeenCalled()
      expect(mockUploadPdfFn).toHaveBeenCalled()
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

    it('should return empty string when PDF generation fails', async () => {
      const pdfError = new Error('PDF generation failed')
      // Reset the mock to ensure it rejects
      mockGeneratePdfFn.mockReset()
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

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      // Should return empty string when PDF generation fails
      expect(result).toBe('')
      expect(mockGeneratePdfFn).toHaveBeenCalled()
      expect(mockUploadPdfFn).not.toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        pdfError,
        'Failed to generate agreement FPTT123456789-1 PDF from URL https://example.com/agreement/FPTT123456789'
      )
    })

    it('should successfully generate and upload PDF with all data fields', async () => {
      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'test-correlation-id',
          clientRef: 'test-client-ref',
          frn: 'test-frn',
          sbi: 'test-sbi',
          version: 2,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          agreementEndDate: '2027-12-31'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      // Verify the full flow executed
      expect(mockGeneratePdfFn).toHaveBeenCalledWith(
        mockPayload.data,
        'FPTT123456789-2.pdf',
        mockLogger
      )
      expect(mockUploadPdfFn).toHaveBeenCalledWith(
        '/path/to/generated.pdf',
        'FPTT123456789-2.pdf',
        'FPTT123456789',
        2,
        '2027-12-31',
        mockLogger
      )
      expect(result).toBe('/path/to/generated.pdf')
    })

    it('should handle upload error in uploadPdfToS3', async () => {
      const uploadError = new Error('S3 upload error')
      mockUploadPdfFn.mockRejectedValueOnce(uploadError)

      const mockPayload = {
        type: 'agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          version: 1,
          status: 'accepted',
          agreementUrl: 'https://example.com/agreement/FPTT123456789',
          agreementEndDate: '2027-01-01'
        }
      }

      const result = await handleEvent(
        'aws-message-id',
        mockPayload,
        mockLogger
      )

      // Verify upload error was handled
      expect(mockUploadPdfFn).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        uploadError,
        'Failed to upload agreement FPTT123456789 PDF /path/to/generated.pdf to S3'
      )
      // Should still return the PDF path even if upload fails
      expect(result).toBe('/path/to/generated.pdf')
    })
  })
})
