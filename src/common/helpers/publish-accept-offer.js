import Boom from '@hapi/boom'
import { config } from '../../config.js'
import { publishEvent } from './sns-publisher.js'

/**
 * Get agreement data for rendering templates
 * @param {Agreement} agreementData - The agreement data
 * @param {Request<ReqRefDefaults>['logger']} logger - The logger object
 * @returns {Promise<Agreement>} The agreement data
 */
export async function publishAcceptOffer(agreementData, logger) {
  if (!agreementData?.agreementNumber) {
    throw Boom.badRequest('Agreement data is required')
  }

  const acceptanceTime = new Date().toISOString()

  // Publish event to SNS
  await publishEvent(
    {
      topicArn: config.get('aws.sns.topic.offerAccepted.arn'),
      type: config.get('aws.sns.topic.offerAccepted.type'),
      time: acceptanceTime,
      data: {
        correlationId: agreementData?.correlationId,
        clientRef: agreementData?.clientRef,
        offerId: agreementData?.agreementNumber,
        frn: agreementData?.frn,
        sbi: agreementData?.sbi
      }
    },
    logger
  )
}
