import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs/promises'

/**
 *
 * @param {string} agreementUrl The agreement URL to be used to generate the PDF
 * @param {string} filename The filename to store the generated PDF
 * @param logger The logger instance
 * @returns {Promise<string>} output path of the file
 */
export async function generatePdf(agreementUrl, filename, logger) {
  let browser = null

  try {
    logger.info('Launching Puppeteer browser')

    browser = await puppeteer.launch({
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

    logger.info('Creating new page')
    const page = await browser.newPage()

    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    })

    logger.info(`Navigating to agreement URL ${agreementUrl} with POST request`)
    await page.goto(agreementUrl, { waitUntil: 'domcontentloaded' })

    await page.evaluate(() => {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = window.location.href

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

    await browser.close()
    browser = null

    await fs.access(outputPath)

    logger.info(
      `PDF ${filename} generated successfully and saved to project root ${outputPath}`
    )

    return outputPath
  } catch (error) {
    logger.error(`Error generating PDF ${filename}: ${error}`)

    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        logger.error(`Error closing browser: ${closeError}`)
      }
    }

    throw error
  }
}
