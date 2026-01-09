import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs/promises'
import * as Jwt from '@hapi/jwt'
import { config } from '~/src/config.js'
import { removeTemporaryFile } from '~/src/common/helpers/file-cleanup.js'

let browserClosed = false

async function createBrowser(logger) {
  logger.info('Launching Puppeteer browser')

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ]
  })

  browser.on('disconnected', () => {
    browserClosed = true
  })

  return browser
}

/**
 * Ensures the temporary directory exists with secure permissions
 * @param {string} tmpFolder - Path to the temporary folder
 * @param {object} logger - Logger instance
 */
async function ensureSecureTmpDir(tmpFolder, logger) {
  try {
    await fs.access(tmpFolder)
  } catch {
    // Directory doesn't exist, create it with restricted permissions (owner only)
    logger.info(`Creating secure temporary directory: ${tmpFolder}`)
    await fs.mkdir(tmpFolder, { recursive: true, mode: 0o700 })
  }
}

/**
 *
 * @param {string} agreementData The agreement data necessary to generate the PDF
 * @param {string} filename The filename to store the generated PDF
 * @param logger The logger instance
 * @returns {Promise<string>} output path of the file
 */
export async function generatePdf(agreementData, filename, logger) {
  let browser = null
  const tmpFolder = config.get('tmpPdfFolder')
  const outputPath = path.resolve(tmpFolder, filename)

  try {
    // Ensure the temporary directory exists with secure permissions
    await ensureSecureTmpDir(tmpFolder, logger)

    browser = await createBrowser(logger)
    const page = await browser.newPage()

    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    })

    const source = 'entra'
    const jwtSecret = config.get('jwtSecret')
    const encryptedAuth = Jwt.token.generate({ source }, jwtSecret)

    logger.info(`Navigating to agreement URL ${agreementData.agreementUrl}`)

    await page.goto(agreementData.agreementUrl, {
      waitUntil: 'domcontentloaded'
    })

    await page.setExtraHTTPHeaders({
      'x-encrypted-auth': encryptedAuth
    })

    // Form submission code - runs in browser context
    const formSubmissionCode = () => {
      const form = document.createElement('form')
      form.method = 'GET'
      form.action = globalThis.location.href

      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'action'
      input.value = 'view-agreement'

      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
    }

    await page.evaluate(formSubmissionCode)

    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    logger.info({ outputPath }, 'Generating PDF')

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    })

    await fs.access(outputPath)

    logger.info(
      `PDF ${filename} generated successfully and saved to ${outputPath}`
    )

    return outputPath
  } catch (err) {
    logger.error(err, `Error generating PDF ${filename}`)

    // Clean up the PDF file if it was created
    await removeTemporaryFile(outputPath, logger)

    throw err
  } finally {
    if (browser && !browserClosed) {
      try {
        await browser.close()
      } catch (error) {
        logger.error(error, `Error closing browser`)
      }
    }
  }
}
