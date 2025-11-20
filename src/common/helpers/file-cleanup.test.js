import { jest } from '@jest/globals'
import * as fsModule from 'node:fs/promises'
import { removeTemporaryFile } from './file-cleanup.js'

// Mock fs/promises
jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  default: {
    unlink: jest.fn()
  }
}))

const mockUnlink = jest.spyOn(fsModule.default, 'unlink')

describe('file-cleanup', () => {
  let mockLogger

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = {
      warn: jest.fn()
    }
    mockUnlink.mockResolvedValue()
  })

  describe('removeTemporaryFile', () => {
    test('should log warning when file removal fails', async () => {
      const filePath = '/tmp/test-file.pdf'
      const error = new Error('Permission denied')
      error.code = 'EPERM'
      mockUnlink.mockRejectedValue(error)

      await removeTemporaryFile(filePath, mockLogger)

      expect(mockUnlink).toHaveBeenCalledWith(filePath)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Failed to cleanup local PDF file ${filePath}: ${error.message}`
      )
    })

    test('should log warning when file does not exist', async () => {
      const filePath = '/tmp/nonexistent.pdf'
      const error = new Error('File not found')
      error.code = 'ENOENT'
      mockUnlink.mockRejectedValue(error)

      await removeTemporaryFile(filePath, mockLogger)

      expect(mockUnlink).toHaveBeenCalledWith(filePath)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Failed to cleanup local PDF file ${filePath}: ${error.message}`
      )
    })
  })
})
