import Boom from '@hapi/boom'
import { generatePdf } from '../../services/pdf-generator.js'

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<String>}
 */
export const handleEvent = async (notificationMessageId, payload, logger) => {
  if (payload.type.indexOf('offer.accepted') !== -1) {
    logger.info(
      `Processing agreement offer from event: ${notificationMessageId}`
    )

    let pdfPath = ''

    // Generate PDF if htmlPage is present
    if (payload.data && payload.data.htmlPage) {
      const agreementNumber = payload.data.agreementNumber
      const filename = `agreement-${agreementNumber}.pdf`

      logger.info(
        { agreementNumber, filename },
        'Generating PDF from HTML content'
      )

      try {
        pdfPath = await generatePdf(payload.data.htmlPage, filename, logger)
        logger.info({ pdfPath, filename }, 'PDF generated successfully')
      } catch (pdfError) {
        logger.error(
          { error: pdfError, agreementNumber },
          'Failed to generate PDF'
        )
      }
    }
    return pdfPath
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
    logger.info('Processing message body:', messageBody)
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
