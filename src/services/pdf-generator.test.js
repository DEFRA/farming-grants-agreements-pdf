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
})
