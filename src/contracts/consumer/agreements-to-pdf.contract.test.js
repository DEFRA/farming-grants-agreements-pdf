import { vi } from 'vitest'
import {
  MessageConsumerPact,
  synchronousBodyHandler,
  MatchersV2
} from '@pact-foundation/pact'

import { handleEvent } from '~/src/common/helpers/sqs-message-processor.js'
import * as pdfGenerator from '~/src/services/pdf-generator.js'
import * as fileUpload from '~/src/services/file-upload.js'
import { buildMessagePactConfig } from '~/src/contracts/consumer/pact-test-helpers.js'

const { like, iso8601DateTimeWithMillis } = MatchersV2

// Use vi.hoisted() to ensure mock functions are available before mock factories run
const { mockGeneratePdfFn, mockUploadPdfFn, mockConfigGet } = vi.hoisted(() => {
  const configFn = vi.fn((key) => {
    if (key === 'allowedDomains') {
      return ['localhost', 'example.com']
    }
    return undefined
  })
  return {
    mockGeneratePdfFn: vi.fn(),
    mockUploadPdfFn: vi.fn(),
    mockConfigGet: configFn
  }
})

// Mocks must be declared before imports (they are hoisted by Vitest)
vi.mock('~/src/services/pdf-generator.js', () => ({
  generatePdf: mockGeneratePdfFn
}))

vi.mock('~/src/services/file-upload.js', () => ({
  uploadPdf: mockUploadPdfFn
}))

// Mock config module as it's used by sqs-message-processor
vi.mock('~/src/config.js', () => ({
  config: {
    get: mockConfigGet
  }
}))

const messagePact = new MessageConsumerPact(
  buildMessagePactConfig(import.meta.url)
)

describe('receive an agreement accepted event', () => {
  it('creates a PDF from a valid agreement', () => {
    return messagePact
      .given('an agreement offer has been accepted')
      .expectsToReceive('a request with the accepted agreement')
      .withContent({
        specversion: like('1.0'),
        time: iso8601DateTimeWithMillis('2025-10-06T16:41:59.497Z'),
        topicArn:
          'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated_fifo.fifo',
        type: 'io.onsite.agreement.status.updated',
        data: {
          agreementNumber: 'FPTT123456789',
          correlationId: 'mockCorrelationId',
          clientRef: 'mockClientRef',
          version: like(1),
          agreementUrl: like('http://localhost:3555/FPTT123456789'),
          status: 'accepted',
          agreementAcceptedDate: iso8601DateTimeWithMillis(
            '2025-10-06T16:40:21.951Z'
          ),
          code: 'mockCode',
          agreementEndData: like('2025-09-31')
        }
      })

      .verify(
        synchronousBodyHandler(async (payload) => {
          const mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
          }

          // Reset and configure mocks before test
          mockGeneratePdfFn.mockClear()
          mockUploadPdfFn.mockClear()
          mockConfigGet.mockClear()

          // Configure mock return values
          mockConfigGet.mockImplementation((key) => {
            if (key === 'allowedDomains') {
              return ['localhost', 'example.com']
            }
            return undefined
          })
          mockGeneratePdfFn.mockResolvedValue('mockPathToPdf')
          mockUploadPdfFn.mockResolvedValue(true)

          // Ensure mocks are applied by spying on the actual module exports
          vi.spyOn(pdfGenerator, 'generatePdf').mockImplementation(
            mockGeneratePdfFn
          )
          vi.spyOn(fileUpload, 'uploadPdf').mockImplementation(mockUploadPdfFn)

          const result = await handleEvent(
            'notificationMessageId',
            payload,
            mockLogger
          )

          expect(mockGeneratePdfFn).toHaveBeenCalledWith(
            {
              agreementNumber: 'FPTT123456789',
              agreementUrl: 'http://localhost:3555/FPTT123456789',
              clientRef: 'mockClientRef',
              code: 'mockCode',
              correlationId: 'mockCorrelationId',
              agreementAcceptedDate: '2025-10-06T16:40:21.951Z',
              status: 'accepted',
              version: 1,
              agreementEndData: '2025-09-31'
            },
            'FPTT123456789-1.pdf',
            mockLogger
          )
          expect(mockUploadPdfFn).toHaveBeenCalledWith(
            'mockPathToPdf',
            'FPTT123456789-1.pdf',
            'FPTT123456789',
            1,
            '2025-09-31',
            mockLogger
          )
          expect(result).toBe('mockPathToPdf')
        })
      )
  })
})
