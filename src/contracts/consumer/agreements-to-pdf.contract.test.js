import path from 'node:path'

import {
  MessageConsumerPact,
  synchronousBodyHandler,
  MatchersV2
} from '@pact-foundation/pact'

import { handleEvent } from '~/src/common/helpers/sqs-message-processor.js'
import { generatePdf as mockGeneratePdf } from '~/src/services/pdf-generator.js'
import { uploadPdf as mockUploadPdf } from '~/src/services/file-upload.js'

const { like, iso8601DateTimeWithMillis } = MatchersV2

jest.mock('~/src/services/pdf-generator.js')
jest.mock('~/src/services/file-upload.js')

const messagePact = new MessageConsumerPact({
  consumer: 'farming-grants-agreements-pdf',
  dir: path.resolve(process.cwd(), 'src', 'contracts', 'consumer', 'pacts'),
  pactfileWriteMode: 'update',
  provider: 'farming-grants-agreements-api'
})

describe('receive an agreement accepted event', () => {
  it('creates a PDF from a valid agreement', () => {
    return messagePact
      .given('an agreement offer has been accepted')
      .expectsToReceive('a request with the accepted agreement')
      .withContent({
        specVersion: like('1.0'),
        time: iso8601DateTimeWithMillis('2025-10-06T16:41:59.497Z'),
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
        type: 'io.onsite.agreement.status.updated',
        data: {
          agreementNumber: 'SFI123456789',
          correlationId: 'mockCorrelationId',
          clientRef: 'mockClientRef',
          version: 'mockVersion',
          agreementUrl: 'http://example.com/mockAgreementUrl',
          status: 'accepted',
          date: iso8601DateTimeWithMillis('2025-10-06T16:40:21.951Z'),
          code: 'mockCode'
        }
      })

      .verify(
        synchronousBodyHandler(async (payload) => {
          const mockLogger = {
            info: jest.fn(),
            error: jest.fn()
          }

          mockGeneratePdf.mockResolvedValue('mockPathToPdf')
          mockUploadPdf.mockResolvedValue(true)

          const result = await handleEvent(
            'notificationMessageId',
            payload,
            mockLogger
          )

          expect(mockGeneratePdf).toHaveBeenCalledWith(
            {
              agreementNumber: 'SFI123456789',
              agreementUrl: 'http://example.com/mockAgreementUrl',
              clientRef: 'mockClientRef',
              code: 'mockCode',
              correlationId: 'mockCorrelationId',
              date: '2025-10-06T16:40:21.951Z',
              status: 'accepted',
              version: 'mockVersion'
            },
            'SFI123456789-mockVersion.pdf',
            mockLogger
          )
          expect(mockUploadPdf).toHaveBeenCalledWith(
            'mockPathToPdf',
            'SFI123456789-mockVersion.pdf',
            'SFI123456789',
            'mockVersion',
            mockLogger
          )
          expect(result).toBe('mockPathToPdf')
        })
      )
  })
})
