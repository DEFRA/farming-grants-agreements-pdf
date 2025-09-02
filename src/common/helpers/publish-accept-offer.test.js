import { publishAcceptOffer } from './publish-accept-offer.js'
import { publishEvent } from './sns-publisher.js'
import { config } from '../../config.js'
import Boom from '@hapi/boom'

jest.mock('./sns-publisher.js')
jest.mock('../../config.js', () => ({
  config: { get: jest.fn() }
}))

const mockPublishEvent = publishEvent

describe('publishAcceptOffer', () => {
  const logger = { info: jest.fn(), error: jest.fn() }
  const mockAgreementData = {
    agreementNumber: 'AGR-123',
    correlationId: 'corr-456',
    clientRef: 'client-789',
    frn: 'frn-101',
    sbi: 'sbi-202'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    config.get.mockImplementation((key) => {
      switch (key) {
        case 'aws.sns.topic.offerAccepted.arn':
          return 'arn:aws:sns:eu-west-2:123456789012:offer-accepted'
        case 'aws.sns.topic.offerAccepted.type':
          return 'com.defra.grants.offer.accepted'
        default:
          return undefined
      }
    })
  })

  it('publishes offer acceptance event successfully', async () => {
    mockPublishEvent.mockResolvedValueOnce()

    await publishAcceptOffer(mockAgreementData, logger)

    expect(mockPublishEvent).toHaveBeenCalledWith(
      {
        topicArn: 'arn:aws:sns:eu-west-2:123456789012:offer-accepted',
        type: 'com.defra.grants.offer.accepted',
        time: expect.any(String),
        data: {
          correlationId: 'corr-456',
          clientRef: 'client-789',
          offerId: 'AGR-123',
          frn: 'frn-101',
          sbi: 'sbi-202'
        }
      },
      logger
    )
  })

  it('throws BadRequest when agreement data is missing', async () => {
    await expect(publishAcceptOffer(null, logger)).rejects.toThrow(
      Boom.badRequest('Agreement data is required')
    )

    expect(mockPublishEvent).not.toHaveBeenCalled()
  })

  it('throws BadRequest when agreementNumber is missing', async () => {
    const invalidAgreementData = { ...mockAgreementData }
    delete invalidAgreementData.agreementNumber

    await expect(
      publishAcceptOffer(invalidAgreementData, logger)
    ).rejects.toThrow(Boom.badRequest('Agreement data is required'))

    expect(mockPublishEvent).not.toHaveBeenCalled()
  })

  it('handles partial agreement data gracefully', async () => {
    const partialAgreementData = {
      agreementNumber: 'AGR-123',
      correlationId: 'corr-456'
    }

    mockPublishEvent.mockResolvedValueOnce()

    await publishAcceptOffer(partialAgreementData, logger)

    expect(mockPublishEvent).toHaveBeenCalledWith(
      {
        topicArn: 'arn:aws:sns:eu-west-2:123456789012:offer-accepted',
        type: 'com.defra.grants.offer.accepted',
        time: expect.any(String),
        data: {
          correlationId: 'corr-456',
          clientRef: undefined,
          offerId: 'AGR-123',
          frn: undefined,
          sbi: undefined
        }
      },
      logger
    )
  })

  it('propagates publishEvent errors', async () => {
    const publishError = new Error('SNS publish failed')
    mockPublishEvent.mockRejectedValueOnce(publishError)

    await expect(publishAcceptOffer(mockAgreementData, logger)).rejects.toThrow(
      'SNS publish failed'
    )
  })
})
