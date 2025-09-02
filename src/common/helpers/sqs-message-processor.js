import Boom from '@hapi/boom'
import { publishAcceptOffer } from './publish-accept-offer.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<Agreement>}
 */
export const handleEvent = async (notificationMessageId, payload, logger) => {
  if (payload.type.indexOf('offer.accepted') !== -1) {
    logger.info(`Creating agreement from event: ${notificationMessageId}`)
    const agreement = await publishAcceptOffer(payload.data, logger)
    logger.info(`Agreement created: ${agreement.agreementNumber}`)
    return agreement
  }

  return Promise.reject(new Error('Unrecognized event type'))
}

/**
 * Process a message from the SQS queue
 * @param { Message } message - The message to process
 * @param { import('@hapi/hapi').Server } logger - The logger instance
 * @returns {Promise<void>}
 */
export const processMessage = async (message, logger) => {
  try {
    const messageBody = JSON.parse(message.Body)
    await handleEvent(message.MessageId, messageBody, logger)
  } catch (error) {
    logger.error('Error processing message:', {
      message,
      error: error.message,
      stack: error.stack
    })

    if (error.name === 'SyntaxError') {
      throw Boom.badData('Invalid message format', {
        message,
        error: error.message
      })
    }

    throw Boom.boomify(error, {
      statusCode: 500,
      message: 'Error processing SQS message',
      data: {
        message,
        originalError: error.message
      }
    })
  }
}
