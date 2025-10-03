import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs/promises'
import * as Jwt from '@hapi/jwt'
import { config } from '../config.js'

async function createBrowser(logger) {
  logger.info('Launching Puppeteer browser')

  return puppeteer.launch({
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

  try {
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
    logger.info(
      `Navigating to agreement URL ${agreementData.agreementUrl} with POST request`
    )
    await page.goto(agreementData.agreementUrl, {
      waitUntil: 'domcontentloaded'
    })

    await page.setExtraHTTPHeaders({
      'x-encrypted-auth': encryptedAuth
    })

    await page.evaluate(() => {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = globalThis.location.href

      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'action'
      input.value = 'view-agreement'

      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
    })

    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    const outputPath = path.resolve(process.cwd(), filename)

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
      `PDF ${filename} generated successfully and saved to project root ${outputPath}`
    )

    await browser.close()

    return outputPath
  } catch (err) {
    logger.error(err, `Error generating PDF ${filename}`)
    throw err
  }
}
