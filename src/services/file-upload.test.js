import { uploadPdf, uploadPdfToS3 } from './file-upload.js'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import { config } from '../config.js'

// Mock dependencies
jest.mock('@aws-sdk/client-s3')
jest.mock('fs/promises')
jest.mock('../config.js')

describe('File Upload Service', () => {
  let mockS3Client
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    mockS3Client = {
      send: jest.fn()
    }

    // Clear all mocks first
    jest.clearAllMocks()

    S3Client.mockImplementation(() => mockS3Client)

    // Mock config values
    config.get.mockImplementation((key) => {
      const configMap = {
        'aws.region': 'eu-west-2',
        'aws.accessKeyId': 'test-key',
        'aws.secretAccessKey': 'test-secret',
        'aws.s3.bucket': 'test-bucket',
        'aws.s3.endpoint': 'http://localhost:4566'
      }
      return configMap[key]
    })
  })

  describe('uploadPdfToS3', () => {
    const testFilePath = '/tmp/test.pdf'
    const testKey = 'agreements/test.pdf'
    const testFileContent = Buffer.from('test pdf content')

    beforeEach(() => {
      fs.readFile.mockResolvedValue(testFileContent)
    })

    test('should upload PDF successfully', async () => {
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)

      const result = await uploadPdfToS3(
        testFilePath,
        testKey,
        mockLogger,
        mockS3Client
      )

      expect(fs.readFile).toHaveBeenCalledWith(testFilePath)
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      )

      expect(result).toEqual({
        success: true,
        bucket: 'test-bucket',
        key: testKey,
        etag: '"test-etag"',
        location: 's3://test-bucket/agreements/test.pdf'
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting PDF upload to S3. key: agreements/test.pdf, filepath: /tmp/test.pdf'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'PDF successfully uploaded to S3. key: agreements/test.pdf, etag: "test-etag", location: s3://test-bucket/agreements/test.pdf'
      )
    })

    test('should throw error when bucket is not configured', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'aws.s3.bucket') return ''
        return 'test-value'
      })

      await expect(
        uploadPdfToS3(testFilePath, testKey, mockLogger, mockS3Client)
      ).rejects.toThrow('S3 bucket name is not configured')

      expect(fs.readFile).toHaveBeenCalledWith(testFilePath)
      expect(mockS3Client.send).not.toHaveBeenCalled()
    })

    test('should handle file read error', async () => {
      const fileError = new Error('File not found')
      fs.readFile.mockRejectedValue(fileError)

      await expect(
        uploadPdfToS3(testFilePath, testKey, mockLogger, mockS3Client)
      ).rejects.toThrow('File not found')

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error uploading PDF ${testFilePath} to S3: File not found`
      )
    })

    test('should handle S3 upload error', async () => {
      const s3Error = new Error('S3 upload failed')
      mockS3Client.send.mockRejectedValue(s3Error)

      await expect(
        uploadPdfToS3(testFilePath, testKey, mockLogger, mockS3Client)
      ).rejects.toThrow('S3 upload failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error uploading PDF ${testFilePath} to S3: S3 upload failed`
      )
    })

    test('should create S3 client with correct configuration', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)

      await uploadPdfToS3(testFilePath, testKey, mockLogger)

      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-2',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret'
        },
        endpoint: 'http://localhost:4566',
        forcePathStyle: true
      })

      process.env.NODE_ENV = originalNodeEnv
    })

    test('should create PutObjectCommand with correct parameters', async () => {
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)

      await uploadPdfToS3(testFilePath, testKey, mockLogger, mockS3Client)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: testKey,
        Body: testFileContent,
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256'
      })
    })
  })

  describe('uploadPdf', () => {
    const testPdfPath = '/tmp/agreement-123.pdf'
    const testFilename = 'agreement-123.pdf'

    test('should upload PDF and cleanup local file successfully', async () => {
      const mockUploadResult = {
        success: true,
        bucket: 'test-bucket',
        key: 'agreements/agreement-123.pdf',
        etag: '"test-etag"',
        location: 's3://test-bucket/agreements/agreement-123.pdf'
      }

      // Mock uploadPdfToS3 by mocking the internal behavior
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))
      fs.unlink.mockResolvedValue()

      const result = await uploadPdf(
        testPdfPath,
        testFilename,
        mockLogger,
        mockS3Client
      )

      expect(result).toEqual(mockUploadResult)
      expect(fs.unlink).toHaveBeenCalledWith(testPdfPath)

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Starting PDF upload process for ${testFilename}`
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Local PDF file ${testPdfPath} cleaned up after upload`
      )
    })

    test('should handle cleanup error gracefully', async () => {
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))

      const cleanupError = new Error('Failed to delete file')
      fs.unlink.mockRejectedValue(cleanupError)

      const result = await uploadPdf(
        testPdfPath,
        testFilename,
        mockLogger,
        mockS3Client
      )

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Failed to cleanup local PDF file ${testPdfPath}: ${cleanupError.message}`
      )
    })

    test('should handle upload error and log appropriately', async () => {
      const uploadError = new Error('Upload failed')
      mockS3Client.send.mockRejectedValue(uploadError)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))

      await expect(
        uploadPdf(testPdfPath, testFilename, mockLogger, mockS3Client)
      ).rejects.toThrow('Upload failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in PDF ${testFilename} generation and upload process: Upload failed`
      )
    })

    test('should generate correct S3 key from filename', async () => {
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))
      fs.unlink.mockResolvedValue()

      await uploadPdf(
        '/some/path/agreement-456.pdf',
        'agreement-456.pdf',
        mockLogger,
        mockS3Client
      )

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'agreements/agreement-456.pdf'
        })
      )
    })
  })
})
