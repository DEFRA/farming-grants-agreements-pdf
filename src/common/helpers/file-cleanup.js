import fs from 'node:fs/promises'

/**
 * Remove a temporary file with proper error handling
 * @param {string} filePath Path to the file to remove
 * @param {Logger} logger Logger instance
 * @returns {Promise<void>}
 */
export async function removeTemporaryFile(filePath, logger) {
  try {
    await fs.unlink(filePath)
  } catch (cleanupError) {
    logger.warn(
      `Failed to cleanup local PDF file ${filePath}: ${cleanupError.message}`
    )
  }
}
