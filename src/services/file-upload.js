import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { config } from '../config.js'

function createS3Client() {
  const clientConfig = {
    region: config.get('aws.region'),
    endpoint: config.get('aws.s3.endpoint'),
    credentials: {
      accessKeyId: config.get('aws.accessKeyId'),
      secretAccessKey: config.get('aws.secretAccessKey')
    },
    forcePathStyle: true
  }

  return new S3Client(
    process.env.NODE_ENV === 'development'
      ? clientConfig
      : // Production will automatically use the default credentials
        {}
  )
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
    logger.error(`Error uploading PDF ${filePath} to S3: ${error.message}`)
    throw error
  }
}

export async function uploadPdf(pdfPath, filename, logger, s3Client = null) {
  try {
    logger.info(`Starting PDF upload process for ${filename}`)

    const key = `agreements/${path.basename(filename)}`

    const uploadResult = await uploadPdfToS3(pdfPath, key, logger, s3Client)

    try {
      await fs.unlink(pdfPath)
      logger.info(`Local PDF file ${pdfPath} cleaned up after upload`)
    } catch (cleanupError) {
      logger.warn(
        `Failed to cleanup local PDF file ${pdfPath}: ${cleanupError.message}`
      )
    }

    return uploadResult
  } catch (error) {
    logger.error(
      `Error in PDF ${filename} generation and upload process: ${error.message}`
    )
    throw error
  }
}
