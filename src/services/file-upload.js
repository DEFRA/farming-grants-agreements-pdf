import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import { differenceInYears } from 'date-fns'
import { config } from '../config.js'

const s3Client = new S3Client(
  process.env.NODE_ENV === 'development'
    ? {
        region: config.get('aws.region'),
        endpoint: config.get('aws.s3.endpoint'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        },
        forcePathStyle: true
      }
    : // Production will automatically use the default credentials
      {}
)

/**
 * Upload PDF to S3 Bucket
 * @param {string} filePath File path of the PDF file
 * @param {string} key S3 Key for the PDF file
 * @param {Logger} logger Logger instance
 * @returns {Promise<{success: boolean, bucket: *, key, etag, location: string}>}
 */
async function upload(filePath, key, logger) {
  try {
    logger.info(`Starting PDF upload to S3. key: ${key}, filepath: ${filePath}`)

    const fileContent = await fs.readFile(filePath)
    const bucket = config.get('aws.s3.bucket')

    if (!bucket) {
      throw new Error('S3 bucket name is not configured')
    }

    const uploadParams = {
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256'
    }

    const result = await s3Client.send(new PutObjectCommand(uploadParams))

    logger.info(
      `PDF successfully uploaded to S3. key: ${key}, etag: ${result.ETag}, location: s3://${bucket}/${key}`
    )

    return {
      success: true,
      bucket,
      key,
      etag: result.ETag,
      location: `s3://${bucket}/${key}`
    }
  } catch (error) {
    logger.error(error, `Error uploading PDF ${filePath} to S3`)
    throw error
  }
}

/**
 * Calculate retention period prefix based on years from now until agreement end date
 * @param {Date|string} endDate Agreement end date
 * @returns {string} S3 prefix for the retention period
 */
export function calculateRetentionPeriod(endDate) {
  const yearsFromNow = differenceInYears(new Date(endDate), new Date())

  // Get base retention years from config
  const baseYears = config.get('aws.s3.retentionBaseYears')
  const totalYears = yearsFromNow + baseYears

  // Get thresholds from config
  const baseThreshold = config.get('aws.s3.baseTermThreshold')
  const extendedThreshold = config.get('aws.s3.extendedTermThreshold')

  // Return the appropriate S3 prefix based on retention thresholds
  if (totalYears <= baseThreshold) {
    return config.get('aws.s3.baseTermPrefix')
  } else if (totalYears <= extendedThreshold) {
    return config.get('aws.s3.extendedTermPrefix')
  } else {
    return config.get('aws.s3.maximumTermPrefix')
  }
}

/**
 * Upload PDF to S3 and cleanup local file
 * @param {string} pdfPath Local path to the PDF file
 * @param {string} filename filename for the PDF file
 * @param {string} agreementNumber Farming agreement document number
 * @param {string} version Farming agreement document version
 * @param {Date|string} endDate Agreement end date
 * @param {Logger} logger Logger instance
 * @returns {Promise<{success: boolean, bucket: *, key: *, etag: *, location: string}>}
 */
export async function uploadPdf(
  pdfPath,
  filename,
  agreementNumber,
  version,
  endDate,
  logger
) {
  try {
    const prefix = calculateRetentionPeriod(endDate)
    const key = [prefix, agreementNumber, version, filename]
      .filter(Boolean)
      .join('/')

    const uploadResult = await upload(pdfPath, key, logger)

    try {
      await fs.unlink(pdfPath)
    } catch (cleanupError) {
      logger.warn(
        `Failed to cleanup local PDF file ${pdfPath}: ${cleanupError.message}`
      )
    }

    return uploadResult
  } catch (err) {
    logger.error(err, `Error in PDF ${filename} generation and upload process`)
    throw err
  }
}
