import { jest } from '@jest/globals'
import { addYears, startOfMonth, addMonths } from 'date-fns'
import * as fsModule from 'node:fs/promises'
import { uploadPdf, calculateRetentionPeriod } from './file-upload.js'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from '../config.js'

// Mock S3 - define the factory inline so it's hoisted
jest.mock('@aws-sdk/client-s3', () => {
  const mockS3Client = {
    send: jest.fn()
  }
  return {
    S3Client: jest.fn(() => mockS3Client),
    PutObjectCommand: jest.fn()
  }
})

// Mock config
jest.mock('../config.js', () => ({
  config: {
    get: jest.fn()
  }
}))

// Get the mocked S3Client instance
const mockS3Client = S3Client()

// Spy on fs methods
const mockReadFile = jest.spyOn(fsModule.default, 'readFile')
const mockUnlink = jest.spyOn(fsModule.default, 'unlink')
const fs = { readFile: mockReadFile, unlink: mockUnlink }

describe('File Upload Service', () => {
  let mockLogger

  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks()

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    // Mock config values
    config.get.mockImplementation((key) => {
      const configMap = {
        'aws.region': 'eu-west-2',
        'aws.accessKeyId': 'test-key',
        'aws.secretAccessKey': 'test-secret',
        'aws.s3.bucket': 'test-bucket',
        'aws.s3.baseTermPrefix': 'base',
        'aws.s3.extendedTermPrefix': 'extended',
        'aws.s3.maximumTermPrefix': 'maximum',
        'aws.s3.baseTermThreshold': 10,
        'aws.s3.extendedTermThreshold': 15,
        'aws.s3.maximumTermThreshold': 20,
        'aws.s3.retentionBaseYears': 7,
        'aws.s3.endpoint': 'http://localhost:4566'
      }
      return configMap[key]
    })
  })

  describe('calculateRetentionPeriod', () => {
    test('should return short-term prefix for 1 year from start of next month', () => {
      // Start date is first day of next month
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 1)
      expect(calculateRetentionPeriod(endDate)).toBe('base')
    })

    test('should return short-term prefix for 2 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 2)
      expect(calculateRetentionPeriod(endDate)).toBe('base')
    })

    test('should return short-term prefix for 3 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 3)
      expect(calculateRetentionPeriod(endDate)).toBe('base')
    })

    test('should return medium-term prefix for 4 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 4)
      expect(calculateRetentionPeriod(endDate)).toBe('extended')
    })

    test('should return medium-term prefix for 5 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 5)
      expect(calculateRetentionPeriod(endDate)).toBe('extended')
    })

    test('should return medium-term prefix for 8 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 8)
      expect(calculateRetentionPeriod(endDate)).toBe('extended')
    })

    test('should return long-term prefix for 9 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 9)
      expect(calculateRetentionPeriod(endDate)).toBe('maximum')
    })

    test('should return long-term prefix for 10 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 10)
      expect(calculateRetentionPeriod(endDate)).toBe('maximum')
    })

    test('should return long-term prefix for 15 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 15)
      expect(calculateRetentionPeriod(endDate)).toBe('maximum')
    })

    test('should return long-term prefix for 20 years from start of next month', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 20)
      expect(calculateRetentionPeriod(endDate)).toBe('maximum')
    })

    test('should handle Date objects as input', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 3)
      expect(calculateRetentionPeriod(endDate)).toBe('base')
    })

    test('should handle string dates as input', () => {
      const startDate = startOfMonth(addMonths(new Date(), 1))
      const endDate = addYears(startDate, 3).toISOString()
      expect(calculateRetentionPeriod(endDate)).toBe('base')
    })
  })

  describe('uploadPdf', () => {
    const testPdfPath = '/tmp/agreement-123.pdf'
    const testFilename = 'agreement-123.pdf'
    // End date should be 3 years from the start of next month
    const startDate = startOfMonth(addMonths(new Date(), 1))
    const testEndDate = addYears(startDate, 3)

    test('should upload PDF and cleanup local file successfully', async () => {
      const mockUploadResult = {
        success: true,
        bucket: 'test-bucket',
        key: 'base/agreement-123/1/agreement-123.pdf',
        etag: '"test-etag"',
        location: 's3://test-bucket/base/agreement-123/1/agreement-123.pdf'
      }

      // Mock S3 send method to return ETag
      const mockS3Result = { ETag: '"test-etag"' }
      mockS3Client.send.mockResolvedValue(mockS3Result)
      fs.readFile.mockResolvedValue(Buffer.from('test content'))
      fs.unlink.mockResolvedValue()

      const result = await uploadPdf(
        testPdfPath,
        testFilename,
        'agreement-123',
        '1',
        testEndDate,
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
        testEndDate,
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
        uploadPdf(
          testPdfPath,
          testFilename,
          'agreement-123',
          '1',
          testEndDate,
          mockLogger
        )
      ).rejects.toThrow('Upload failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        uploadError,
        `Error in PDF ${testFilename} generation and upload process`
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
        testEndDate,
        mockLogger
      )

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'base/agreement-456/1/agreement-456.pdf'
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
          testEndDate,
          mockLogger
        )
      ).rejects.toThrow('S3 bucket name is not configured')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'S3 bucket name is not configured'
        }),
        `Error uploading PDF /some/path/agreement-456.pdf to S3`
      )
    })
  })
})
