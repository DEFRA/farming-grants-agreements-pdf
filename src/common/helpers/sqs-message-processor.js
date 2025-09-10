import Boom from '@hapi/boom'
import { generatePdf } from '../../services/pdf-generator.js'
import { uploadPdf } from '../../services/file-upload.js'

/**
 * Generate and upload PDF from agreement URL
 * @param {object} data - The payload data containing agreement data
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<string>} The path to the generated PDF
 */
const generateAndUploadPdf = async (data, logger) => {
  const agreementNumber = data.agreementNumber

  // version is currently hardcoded until the version is passed from the API service
  const version = 1
  const filename = `${agreementNumber}-${version}.pdf`

  logger.info(
    `Generating Agreement ${agreementNumber}-${version} PDF from agreement URL ${data.agreementUrl}`
  )

  let pdfPath = ''

  try {
    pdfPath = await generatePdf(data.agreementUrl, filename, logger)
    logger.info(`PDF ${filename} generated successfully and save to ${pdfPath}`)
  } catch (pdfError) {
    logger.error(
      `Failed to generate agreement ${agreementNumber}-${version} PDF. Error: ${pdfError}`
    )
    return pdfPath
  }

  await uploadPdfToS3(pdfPath, filename, agreementNumber, logger)
  return pdfPath
}

/**
 * Upload PDF to S3
 * @param {string} pdfPath - The path to the PDF file
 * @param {string} filename - The filename for the PDF
 * @param {string} agreementNumber - The agreement number
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<void>}
 */
const uploadPdfToS3 = async (pdfPath, filename, agreementNumber, logger) => {
  try {
    const uploadResult = await uploadPdf(pdfPath, filename, logger)
    logger.info(
      `Agreement ${agreementNumber} PDF uploaded successfully (${uploadResult.success}) to S3`
    )
  } catch (uploadError) {
    logger.error(
      `Failed to upload agreement ${agreementNumber} PDF ${pdfPath} to S3. Error: ${uploadError}`
    )
  }
}

/**
 * Process an offer accepted event
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<string>} The path to the generated PDF
 */
const processOfferAcceptedEvent = async (
  notificationMessageId,
  payload,
  logger
) => {
  logger.info(`Processing agreement offer from event: ${notificationMessageId}`)

  if (!payload?.data?.agreementUrl) {
    return ''
  }

  return generateAndUploadPdf(payload.data, logger)
}

/**
 * Handle an event from the SQS queue
 * @param {string} notificationMessageId - The AWS notification message ID
 * @param {object} payload - The message payload
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<String>}
 */
export const handleEvent = async (notificationMessageId, payload, logger) => {
  if (payload.type.indexOf('offer.accepted') === -1) {
    return Promise.reject(new Error('Unrecognized event type'))
  }

  return processOfferAcceptedEvent(notificationMessageId, payload, logger)
}

/**
 * Handle message processing errors
 * @param {Error} error - The error that occurred
 * @param {object} message - The SQS message that caused the error
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @throws {Error} Throws a Boom error
 */
const handleProcessingError = (error, message, logger) => {
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
    handleProcessingError(error, message, logger)
  }
}
