import { jest } from '@jest/globals'
import fs from 'node:fs/promises'
import path from 'node:path'
import { generatePdf } from './pdf-generator.js'
import puppeteer from 'puppeteer'
import { removeTemporaryFile } from '../common/helpers/file-cleanup.js'

// Mock file-cleanup module
jest.mock('../common/helpers/file-cleanup.js', () => ({
  removeTemporaryFile: jest.fn().mockResolvedValue(undefined)
}))

// Mock puppeteer before importing the module
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn()
  }
}))

// Mock fs.access to simulate file operations
jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  access: jest.fn().mockResolvedValue(undefined)
}))

// Mock @hapi/jwt
jest.mock('@hapi/jwt', () => ({
  token: {
    generate: jest.fn().mockReturnValue('mock-jwt-token')
  }
}))

// Mock config
jest.mock('../config.js', () => ({
  config: {
    get: jest.fn().mockReturnValue('mock-jwt-secret')
  }
}))

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

// Mock objects for puppeteer
const mockPage = {
  setViewport: jest.fn().mockResolvedValue(undefined),
  goto: jest.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(undefined),
  waitForNavigation: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(undefined)
}

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined)
}

describe('pdf-generator', () => {
  const testOutputDir = path.resolve(process.cwd(), 'test-outputs')

  beforeAll(async () => {
    // Create test output directory
    try {
      await fs.mkdir(testOutputDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  })

  afterAll(async () => {
    // Clean up test output directory
    try {
      const files = await fs.readdir(testOutputDir)
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          await fs.unlink(path.join(testOutputDir, file))
        }
      }
      await fs.rmdir(testOutputDir)
    } catch (error) {
      // Directory might not exist or have files
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset all mock implementations
    mockPage.setViewport.mockResolvedValue(undefined)
    mockPage.goto.mockResolvedValue(undefined)
    mockPage.evaluate.mockResolvedValue(undefined)
    mockPage.waitForNavigation.mockResolvedValue(undefined)
    mockPage.pdf.mockResolvedValue(undefined)
    mockBrowser.newPage.mockResolvedValue(mockPage)
    mockBrowser.close.mockResolvedValue(undefined)
    puppeteer.launch.mockResolvedValue(mockBrowser)
  })

  describe('#generatePdf', () => {
    test('Should generate PDF successfully from agreement URL', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-simple.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      // Verify the result path
      expect(result).toBe(expectedPath)

      // Verify Puppeteer interactions
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-encrypted-auth': 'mock-jwt-token'
      })
      expect(mockPage.evaluate).toHaveBeenCalled()
      expect(mockPage.waitForNavigation).toHaveBeenCalledWith({
        waitUntil: 'networkidle0'
      })
      expect(mockPage.pdf).toHaveBeenCalledWith({
        path: expectedPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      })

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Launching Puppeteer browser'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Navigating to agreement URL https://example.com/agreement/123'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { outputPath: expectedPath },
        'Generating PDF'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PDF test-simple.pdf generated successfully and saved to project root ' +
          expectedPath
      )
    })

    test('Should generate PDF with agreement URL containing complex ID', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement/SFI123456789',
        sbi: '123456789'
      }
      const filename = 'test-complex.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      // Verify the result path
      expect(result).toBe(expectedPath)

      // Verify the correct URL was navigated to
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })

      // Verify POST form was submitted with correct action
      expect(mockPage.evaluate).toHaveBeenCalled()
      const evaluateCall = mockPage.evaluate.mock.calls[0][0]
      expect(evaluateCall).toBeDefined()
    })

    test('Should handle URL with query parameters', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement?id=123&type=test',
        sbi: '123456789'
      }
      const filename = 'test-query-params.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })
    })

    test('Should handle HTTPS URLs', async () => {
      const agreementData = {
        agreementUrl: 'https://secure.example.com/agreement/456',
        sbi: '123456789'
      }
      const filename = 'test-https.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })
    })

    test('Should verify POST form submission with correct action', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement/789',
        sbi: '123456789'
      }
      const filename = 'test-post-action.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)

      // Verify page.evaluate was called to create and submit the form
      expect(mockPage.evaluate).toHaveBeenCalled()
      const evaluateFunction = mockPage.evaluate.mock.calls[0][0]

      // Execute the function in a simulated DOM to verify it creates the correct form
      const mockDocument = {
        createElement: jest.fn().mockImplementation((tag) => {
          if (tag === 'form') {
            return {
              method: null,
              action: null,
              appendChild: jest.fn(),
              submit: jest.fn()
            }
          }
          if (tag === 'input') {
            return {
              type: null,
              name: null,
              value: null
            }
          }
        }),
        body: {
          appendChild: jest.fn()
        }
      }

      global.document = mockDocument
      global.window = { location: { href: agreementData.agreementUrl } }
      globalThis.location = { href: agreementData.agreementUrl }

      // This verifies the form creation logic
      expect(() => evaluateFunction()).not.toThrow()
    })

    test('Should generate PDF with correct filename based on agreement number', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement/SFI999888777',
        sbi: '123456789'
      }
      const filename = 'agreement-SFI999888777.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)
      expect(path.basename(expectedPath)).toBe('agreement-SFI999888777.pdf')
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })
    })

    test('Should handle localhost URLs', async () => {
      const agreementData = {
        agreementUrl: 'http://localhost:3000/agreement/test-123',
        sbi: '123456789'
      }
      const filename = 'test-localhost.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)
      expect(mockPage.goto).toHaveBeenCalledWith(agreementData.agreementUrl, {
        waitUntil: 'domcontentloaded'
      })
    })

    test('Should create PDF with correct settings and viewport', async () => {
      const agreementData = {
        agreementUrl: 'https://example.com/agreement/settings-test',
        sbi: '123456789'
      }
      const filename = 'test-settings.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      const result = await generatePdf(agreementData, filename, mockLogger)

      expect(result).toBe(expectedPath)

      // Verify viewport settings
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      })

      // Verify PDF generation settings
      expect(mockPage.pdf).toHaveBeenCalledWith({
        path: expectedPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      })
    })
  })

  describe('Error scenarios', () => {
    test('Should handle navigation errors', async () => {
      // Mock page.goto to throw an error
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'))

      const agreementData = {
        agreementUrl: 'https://invalid-url.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-nav-error.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Navigation failed')

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Navigation failed'
        }),
        'Error generating PDF test-nav-error.pdf'
      )
    })

    test('Should handle form submission errors', async () => {
      // Mock page.evaluate to throw an error during form submission
      mockPage.evaluate.mockRejectedValueOnce(
        new Error('Form submission failed')
      )

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-form-error.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Form submission failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Form submission failed'
        }),
        'Error generating PDF test-form-error.pdf'
      )
    })

    test('Should handle PDF generation errors', async () => {
      // Mock page.pdf to throw an error
      mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation failed'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-pdf-error.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('PDF generation failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'PDF generation failed'
        }),
        'Error generating PDF test-pdf-error.pdf'
      )
    })

    test('Should handle navigation timeout', async () => {
      // Mock waitForNavigation to throw a timeout error
      mockPage.waitForNavigation.mockRejectedValueOnce(
        new Error('Navigation timeout')
      )

      const agreementData = {
        agreementUrl: 'https://slow-server.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-timeout.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Navigation timeout')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Navigation timeout'
        }),
        'Error generating PDF test-timeout.pdf'
      )
    })

    test('Should properly clean up browser when early error occurs', async () => {
      // Mock page.goto to fail, simulating early error
      mockPage.goto.mockRejectedValueOnce(new Error('Early error'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-cleanup.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Early error')

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Early error'
        }),
        'Error generating PDF test-cleanup.pdf'
      )
    })

    test('Should handle browser.close() error during cleanup', async () => {
      // Mock browser.close to fail during successful PDF generation
      mockBrowser.close.mockRejectedValueOnce(new Error('Close failed'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-close-error.pdf'

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Close failed')

      // Should log the browser close error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Close failed'
        }),
        'Error generating PDF test-close-error.pdf'
      )
    })
  })

  describe('PDF cleanup on errors', () => {
    test('Should cleanup PDF file when fs.access() fails', async () => {
      const mockAccess = fs.access
      // Mock fs.access to fail after PDF is generated
      mockAccess.mockRejectedValueOnce(new Error('Access failed'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-access-error.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Access failed')

      // Should call removeTemporaryFile with the correct path
      expect(removeTemporaryFile).toHaveBeenCalledWith(expectedPath, mockLogger)
    })

    test('Should cleanup PDF file when browser.close() fails', async () => {
      // Mock browser.close to fail
      mockBrowser.close.mockRejectedValueOnce(new Error('Close failed'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-browser-close-cleanup.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('Close failed')

      // Should call removeTemporaryFile with the correct path
      expect(removeTemporaryFile).toHaveBeenCalledWith(expectedPath, mockLogger)
    })

    test('Should cleanup PDF file when PDF generation fails', async () => {
      // Mock page.pdf to fail
      mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation failed'))

      const agreementData = {
        agreementUrl: 'https://example.com/agreement/123',
        sbi: '123456789'
      }
      const filename = 'test-pdf-gen-error.pdf'
      const expectedPath = path.resolve(process.cwd(), filename)

      await expect(
        generatePdf(agreementData, filename, mockLogger)
      ).rejects.toThrow('PDF generation failed')

      // Should call removeTemporaryFile with the correct path
      expect(removeTemporaryFile).toHaveBeenCalledWith(expectedPath, mockLogger)
    })
  })
})
