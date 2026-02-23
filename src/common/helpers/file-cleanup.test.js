import { vi } from 'vitest'
import * as fsModule from 'node:fs/promises'
import { removeTemporaryFile } from '#~/common/helpers/file-cleanup.js'

// Mock fs/promises
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      unlink: vi.fn()
    },
    unlink: vi.fn()
  }
})

const mockUnlink = vi.spyOn(fsModule.default, 'unlink')

describe('file-cleanup', () => {
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = {
      warn: vi.fn()
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
