import Boom from '@hapi/boom'
import { generatePdf } from '~/src/services/pdf-generator.js'
import { uploadPdf } from '~/src/services/file-upload.js'
import { config } from '~/src/config.js'

/**
 * Generate and upload PDF from agreement URL
 * @param {object} data - The payload data containing agreement data
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<string>} The path to the generated PDF
 */
const generateAndUploadPdf = async (data, logger) => {
  const agreementNumber = data.agreementNumber
  const version = data.version
  const endDate = data.agreementEndData

  // version is currently hardcoded until the version is passed from the API service
  const filename = `${agreementNumber}-${version}.pdf`

  logger.info(
    `Generating Agreement ${agreementNumber}-${version} PDF from agreement URL ${data.agreementUrl}`
  )

  let pdfPath = ''

  try {
    pdfPath = await generatePdf(data, filename, logger)
    logger.info(`PDF ${filename} generated successfully and save to ${pdfPath}`)
  } catch (err) {
    logger.error(
      err,
      `Failed to generate agreement ${agreementNumber}-${version} PDF from URL ${data.agreementUrl}`
    )
    return pdfPath
  }

  await uploadPdfToS3(
    pdfPath,
    filename,
    agreementNumber,
    version,
    endDate,
    logger
  )
  return pdfPath
}

/**
 * Upload PDF to S3
 * @param {string} pdfPath - The path to the PDF file
 * @param {string} filename - The filename for the PDF
 * @param {string} agreementNumber - The agreement number
 * @param {number} version - The agreement version
 * @param {Date|string} endDate - The agreement end date
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @returns {Promise<void>}
 */
const uploadPdfToS3 = async (
  pdfPath,
  filename,
  agreementNumber,
  version,
  endDate,
  logger
) => {
  try {
    const uploadResult = await uploadPdf(
      pdfPath,
      filename,
      agreementNumber,
      version,
      endDate,
      logger
    )
    logger.info(
      `Agreement ${agreementNumber} PDF uploaded successfully (${uploadResult.success}) to S3`
    )
  } catch (err) {
    logger.error(
      err,
      `Failed to upload agreement ${agreementNumber} PDF ${pdfPath} to S3`
    )
  }
}

/**
 * Check if the URL domain is allowed
 * @param {string} url
 * @returns {boolean}
 */
const isUrlDomainAllowed = (url) => {
  const domain = new URL(url).hostname
  return config.get('allowedDomains').includes(domain)
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

  if (payload.data.status !== 'accepted') {
    logger.info(`Skipping PDF generation for status: ${payload.data.status}`)
    return ''
  }

  if (!isUrlDomainAllowed(payload.data.agreementUrl)) {
    logger.warn(
      `Skipping PDF generation for URL: ${payload.data.agreementUrl} domain is not on allow list`
    )
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
  if (!payload.type.includes('agreement.status.updated')) {
    throw new Error('Unrecognized event type')
  }

  return processOfferAcceptedEvent(notificationMessageId, payload, logger)
}

/**
 * Handle message processing errors
 * @param {Error} err - The error that occurred
 * @param {object} message - The SQS message that caused the error
 * @param {import('@hapi/hapi').Server} logger - The logger instance
 * @throws {Error} Throws a Boom error
 */
const handleProcessingError = (err, message, logger) => {
  logger.error(err, 'Error processing message')

  if (err.name === 'SyntaxError') {
    throw Boom.badData('Invalid message format', {
      message,
      error: err.message
    })
  }

  throw Boom.boomify(err, {
    statusCode: 500,
    message: 'Error processing SQS message',
    data: {
      message,
      originalError: err.message
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
    logger.info('Processing message body:', JSON.stringify(messageBody))
    await handleEvent(message.MessageId, messageBody, logger)
  } catch (err) {
    handleProcessingError(err, message, logger)
  }
}
