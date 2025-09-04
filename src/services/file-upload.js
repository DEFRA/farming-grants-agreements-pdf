import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { config } from '../config.js'

function createS3Client() {
  const clientConfig = {
    region: config.get('aws.region'),
    credentials: {
      accessKeyId: config.get('aws.accessKeyId'),
      secretAccessKey: config.get('aws.secretAccessKey')
    }
  }

  const endpoint = config.get('aws.s3.endpoint')
  if (endpoint) {
    clientConfig.endpoint = endpoint
    clientConfig.forcePathStyle = true
  }

  return new S3Client(clientConfig)
}

export async function uploadPdfToS3(filePath, key, logger, s3Client = null) {
  try {
    logger.info({ filePath, key }, 'Starting PDF upload to S3')

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

    const client = s3Client || createS3Client()
    const command = new PutObjectCommand(uploadParams)

    const result = await client.send(command)

    logger.info(
      {
        bucket,
        key,
        etag: result.ETag,
        location: `s3://${bucket}/${key}`
      },
      'PDF successfully uploaded to S3'
    )

    return {
      success: true,
      bucket,
      key,
      etag: result.ETag,
      location: `s3://${bucket}/${key}`
    }
  } catch (error) {
    logger.error(
      { error: error.message, filePath, key },
      'Error uploading PDF to S3'
    )
    throw error
  }
}

export async function uploadPdf(pdfPath, filename, logger, s3Client = null) {
  try {
    logger.info({ filename }, `Starting PDF upload process for ${filename}`)

    const key = `agreements/${path.basename(filename)}`

    const uploadResult = await uploadPdfToS3(pdfPath, key, logger, s3Client)

    try {
      await fs.unlink(pdfPath)
      logger.info({ pdfPath }, 'Local PDF file cleaned up after upload')
    } catch (cleanupError) {
      logger.warn({ cleanupError, pdfPath }, 'Failed to cleanup local PDF file')
    }

    return uploadResult
  } catch (error) {
    logger.error(
      { error: error.message, filename },
      'Error in PDF generation and upload process'
    )
    throw error
  }
}
