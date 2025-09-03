import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs/promises'

export async function generatePdf(htmlContent, filename, logger) {
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

    logger.info('Setting HTML content')
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    })

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
      { outputPath, filename },
      'PDF generated successfully and saved to project root'
    )

    return outputPath
  } catch (error) {
    logger.error({ error, filename }, 'Error generating PDF')

    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        logger.error({ closeError }, 'Error closing browser')
      }
    }

    throw error
  }
}
