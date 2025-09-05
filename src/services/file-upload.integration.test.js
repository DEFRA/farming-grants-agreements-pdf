import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { uploadPdf } from './file-upload.js'
import { config } from '../config.js'

describe('File Upload Integration Tests', () => {
  let s3Client
  const testBucket = config.get('aws.s3.bucket')
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }

  beforeAll(() => {
    // Create S3 client for LocalStack
    s3Client = new S3Client({
      region: config.get('aws.region'),
      credentials: {
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretAccessKey')
      },
      endpoint: config.get('aws.s3.endpoint'),
      forcePathStyle: true
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('S3 Upload and Download', () => {
    test('should upload a PDF and be able to download it back', async () => {
      // Create a test PDF file
      const testContent = 'This is a test PDF content'
      const testFilename = 'test-agreement-123.pdf'
      const testFilePath = path.join('/tmp', testFilename)

      // Write test content to a temporary file
      await fs.writeFile(testFilePath, testContent)

      try {
        // Upload the file
        const uploadResult = await uploadPdf(
          testFilePath,
          testFilename,
          mockLogger
        )

        expect(uploadResult.success).toBe(true)
        expect(uploadResult.bucket).toBe(testBucket)
        expect(uploadResult.key).toBe(`agreements/${testFilename}`)
        expect(uploadResult.location).toBe(
          `s3://${testBucket}/agreements/${testFilename}`
        )

        // Download the file from S3
        const downloadParams = {
          Bucket: testBucket,
          Key: `agreements/${testFilename}`
        }

        const getCommand = new GetObjectCommand(downloadParams)
        const downloadResult = await s3Client.send(getCommand)

        // Convert the stream to string
        const downloadedContent = await streamToString(downloadResult.Body)

        // Verify the content matches
        expect(downloadedContent).toBe(testContent)
        expect(downloadResult.ContentType).toBe('application/pdf')

        // Verify logging
        expect(mockLogger.info).toHaveBeenCalledWith(
          { filename: testFilename },
          `Starting PDF upload process for ${testFilename}`
        )

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            bucket: testBucket,
            key: `agreements/${testFilename}`,
            location: `s3://${testBucket}/agreements/${testFilename}`
          }),
          'PDF successfully uploaded to S3'
        )
      } finally {
        // Clean up: the uploadPdf function should have already deleted the local file
        // but let's make sure and also clean up the S3 object
        try {
          await fs.access(testFilePath)
          // If file still exists, delete it
          await fs.unlink(testFilePath)
        } catch {
          // File doesn't exist, which is expected
        }
      }
    })
  })
})

// Helper function to convert stream to string
async function streamToString(stream) {
  const chunks = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}
