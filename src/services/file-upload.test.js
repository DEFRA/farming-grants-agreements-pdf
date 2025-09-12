import { uploadPdf } from './file-upload.js'
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

  describe('uploadPdf', () => {
    const testPdfPath = '/tmp/agreement-123.pdf'
    const testFilename = 'agreement-123.pdf'

    test('should upload PDF and cleanup local file successfully', async () => {
      const mockUploadResult = {
        success: true,
        bucket: 'test-bucket',
        key: 'agreements/agreement-123/1/agreement-123.pdf',
        etag: '"test-etag"',
        location:
          's3://test-bucket/agreements/agreement-123/1/agreement-123.pdf'
      }

      // Mock file-upload.js upload function by mocking the internal behavior
      const mockResult = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockResult)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))
      fs.unlink.mockResolvedValue()

      const result = await uploadPdf(
        testPdfPath,
        testFilename,
        'agreement-123',
        '1',
        mockLogger
      )

      expect(result).toEqual(mockUploadResult)
      expect(fs.unlink).toHaveBeenCalledWith(testPdfPath)
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
        'agreement-123',
        '1',
        mockLogger
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
        uploadPdf(testPdfPath, testFilename, 'agreement-123', '1', mockLogger)
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
        'agreement-456',
        '1',
        mockLogger
      )

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'agreements/agreement-456/1/agreement-456.pdf'
        })
      )
    })

    test('should throw error when bucket is not configured', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'aws.s3.bucket') return ''
        return 'test-value'
      })

      await expect(
        uploadPdf(
          '/some/path/agreement-456.pdf',
          'agreement-456.pdf',
          'agreement-456',
          '1',
          mockLogger
        )
      ).rejects.toThrow('S3 bucket name is not configured')

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error uploading PDF /some/path/agreement-456.pdf to S3: S3 bucket name is not configured`
      )
    })
  })
})
