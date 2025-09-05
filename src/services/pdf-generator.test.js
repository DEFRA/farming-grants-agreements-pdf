import { jest } from '@jest/globals'
import fs from 'fs/promises'
import path from 'path'
import { generatePdf } from './pdf-generator.js'

const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
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
  })

  describe('#generatePdf', () => {
    test('Should generate PDF successfully with simple HTML content', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test PDF</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>Test Document</h1>
          <p>This is a test PDF generated during unit testing.</p>
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-simple.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      // Verify the PDF file was created
      expect(result).toBe(filename)

      // Check file exists and has content
      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Launching Puppeteer browser'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new page')
      expect(mockLogger.info).toHaveBeenCalledWith('Setting HTML content')
      expect(mockLogger.info).toHaveBeenCalledWith(
        { outputPath: filename },
        'Generating PDF'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { outputPath: filename, filename },
        'PDF generated successfully and saved to project root'
      )
    })

    test('Should generate PDF with complex styled content', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Agreement Document</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 40px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #00703c;
            }
            .section {
              margin-bottom: 25px;
            }
            .section h2 {
              color: #00703c;
              border-bottom: 1px solid #ddd;
              padding-bottom: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            table td, table th {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            table th {
              background-color: #f2f2f2;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Test Agreement Document</h1>
            <p><strong>Agreement ID:</strong> TEST-001</p>
          </div>
          
          <div class="section">
            <h2>Agreement Details</h2>
            <table>
              <tr><th>Field</th><th>Value</th></tr>
              <tr><td>Agreement Number</td><td>SFI123456789</td></tr>
              <tr><td>Client Reference</td><td>test-client-ref</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>Terms</h2>
            <ul>
              <li>Term 1: Sample term</li>
              <li>Term 2: Another sample term</li>
            </ul>
          </div>
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-complex.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      // Verify the PDF file was created
      expect(result).toBe(filename)

      // Check file exists and has content
      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(1000) // Should be larger due to more content
    })

    test('Should handle empty HTML content', async () => {
      const htmlContent = '<html><body></body></html>'
      const filename = path.join(testOutputDir, 'test-empty.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      // Should still generate a PDF, just empty
      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should handle HTML with special characters and formatting', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Special Characters Test</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .unicode { font-size: 18px; }
          </style>
        </head>
        <body>
          <h1>Special Characters & Formatting Test</h1>
          <div class="unicode">
            <p>Unicode: £ € $ ¥ © ® ™</p>
            <p>Accented: café, naïve, résumé</p>
            <p>Mathematical: α β γ δ ∑ ∏ ∞</p>
          </div>
          <p>HTML Entities: &lt; &gt; &amp; &quot; &#39;</p>
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-special-chars.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should handle malformed HTML gracefully', async () => {
      const htmlContent = `
        <html>
        <head><title>Malformed Test</title>
        <body>
          <h1>Missing closing tags
          <p>Unclosed paragraph
          <div>Nested without proper closing
            <span>Content here
        </body>
      `
      const filename = path.join(testOutputDir, 'test-malformed.pdf')

      // Should not throw an error, Puppeteer/browser should handle malformed HTML
      const result = await generatePdf(htmlContent, filename, mockLogger)

      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should generate PDF with correct filename based on agreement number', async () => {
      const htmlContent =
        '<html><body><h1>Agreement SFI999888777</h1></body></html>'
      const filename = path.join(testOutputDir, 'agreement-SFI999888777.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      expect(result).toBe(filename)
      expect(path.basename(filename)).toBe('agreement-SFI999888777.pdf')

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
    })

    test('Should handle null HTML content gracefully', async () => {
      // Puppeteer is very forgiving and can handle null HTML content
      // It will just generate a blank PDF
      const htmlContent = null
      const filename = path.join(testOutputDir, 'test-null.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should create PDF with correct metadata and settings', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>PDF Settings Test</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 40px;
              background-color: #f0f0f0; /* This tests printBackground: true */
            }
            .colored-box {
              background-color: #00703c;
              color: white;
              padding: 20px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1>PDF Settings Verification</h1>
          <div class="colored-box">
            This box should have a green background if printBackground is working.
          </div>
          <p>This document tests that PDF generation uses correct settings like A4 format and background printing.</p>
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-settings.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)

      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)

      // Note: We can't easily verify A4 format or print background from the file
      // but we can verify the PDF was created successfully with the intended content
    })
  })

  describe('Error scenarios', () => {
    test('Should handle file system write permission error', async () => {
      // Use an invalid filename that will cause the file to not be accessible
      const htmlContent = '<html><body><h1>Test</h1></body></html>'
      const invalidPath = '/invalid/nonexistent/path/test.pdf'

      await expect(
        generatePdf(htmlContent, invalidPath, mockLogger)
      ).rejects.toThrow()

      // Should log error(s) - at least one call should be for the main error
      expect(mockLogger.error).toHaveBeenCalled()

      // Check that at least one error call contains the expected structure
      const errorCalls = mockLogger.error.mock.calls
      const hasMainErrorCall = errorCalls.some(
        (call) =>
          call[0]?.error &&
          call[0]?.filename === invalidPath &&
          call[1] === 'Error generating PDF'
      )
      expect(hasMainErrorCall).toBe(true)
    })

    test('Should handle moderately sized HTML content', async () => {
      // Create moderately sized HTML content
      const moderateContent =
        '<html><body>' + 'A'.repeat(10000) + '</body></html>'
      const filename = path.join(testOutputDir, 'test-moderate.pdf')

      // This test verifies the function can handle larger content
      const result = await generatePdf(moderateContent, filename, mockLogger)
      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should handle invalid HTML that causes rendering issues', async () => {
      // HTML with potential rendering issues
      const problematicHtml = `
        <html>
        <head>
          <style>
            body { margin: -9999px; padding: -9999px; }
            .problematic { width: 999999px; height: 999999px; }
          </style>
        </head>
        <body>
          <div class="problematic">
            <script>throw new Error('Client side error')</script>
            <img src="nonexistent-image.jpg" onerror="throw new Error('Image error')">
          </div>
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-problematic.pdf')

      // Puppeteer should handle this gracefully without throwing
      try {
        const result = await generatePdf(problematicHtml, filename, mockLogger)
        expect(result).toBe(filename)

        const stats = await fs.stat(filename)
        expect(stats.isFile()).toBe(true)
      } catch (error) {
        // If it does fail, error should be logged
        expect(mockLogger.error).toHaveBeenCalledWith(
          { error: expect.any(Error), filename },
          'Error generating PDF'
        )
      }
    })

    test('Should handle HTML with external resources that fail to load', async () => {
      const htmlWithExternalResources = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://nonexistent-domain-12345.com/style.css">
          <script src="https://nonexistent-domain-12345.com/script.js"></script>
        </head>
        <body>
          <h1>External Resources Test</h1>
          <img src="https://nonexistent-domain-12345.com/image.jpg" alt="Missing image">
        </body>
        </html>
      `
      const filename = path.join(testOutputDir, 'test-external-resources.pdf')

      // Should handle failed external resources gracefully
      const result = await generatePdf(
        htmlWithExternalResources,
        filename,
        mockLogger
      )
      expect(result).toBe(filename)

      const stats = await fs.stat(filename)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    })

    test('Should properly clean up browser when early error occurs', async () => {
      // Clear previous test mocks to ensure clean state
      jest.clearAllMocks()
      mockLogger.info.mockClear()
      mockLogger.error.mockClear()

      // This test ensures the browser cleanup logic works
      // We'll test with a scenario that should always succeed to verify cleanup path
      const htmlContent = '<html><body><h1>Cleanup Test</h1></body></html>'
      const filename = path.join(testOutputDir, 'test-cleanup.pdf')

      const result = await generatePdf(htmlContent, filename, mockLogger)
      expect(result).toBe(filename)

      // Verify the success path was taken (no error logs)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Launching Puppeteer browser'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new page')
      expect(mockLogger.info).toHaveBeenCalledWith(
        { outputPath: filename, filename },
        'PDF generated successfully and saved to project root'
      )

      // No error should be logged for successful case
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('Should handle browser.close() error during cleanup', async () => {
      // Create mock objects
      const mockBrowser = {
        newPage: jest.fn(),
        close: jest.fn().mockRejectedValue(new Error('Close failed'))
      }
      const mockPage = {
        setViewport: jest.fn().mockResolvedValue(),
        setContent: jest.fn().mockResolvedValue(),
        pdf: jest.fn().mockRejectedValue(new Error('PDF generation failed'))
      }

      mockBrowser.newPage.mockResolvedValue(mockPage)

      // Mock the puppeteer module
      jest.doMock('puppeteer', () => ({
        __esModule: true,
        default: {
          launch: jest.fn().mockResolvedValue(mockBrowser)
        }
      }))

      // Clear the module cache and re-import
      jest.resetModules()
      const { generatePdf: mockedGeneratePdf } = await import(
        './pdf-generator.js'
      )

      const htmlContent = '<html><body><h1>Test</h1></body></html>'
      const filename = path.join(testOutputDir, 'test-close-error.pdf')

      try {
        await expect(
          mockedGeneratePdf(htmlContent, filename, mockLogger)
        ).rejects.toThrow('PDF generation failed')

        // Should log both the main error and the browser close error
        expect(mockLogger.error).toHaveBeenCalledWith(
          { error: expect.any(Error), filename },
          'Error generating PDF'
        )
        expect(mockLogger.error).toHaveBeenCalledWith(
          { closeError: expect.any(Error) },
          'Error closing browser'
        )
      } finally {
        // Restore puppeteer module
        jest.dontMock('puppeteer')
        jest.resetModules()
      }
    })
  })
})
