import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const pactConsumer = 'farming-grants-agreements-pdf'
export const pactProvider = 'farming-grants-agreements-api'

export const pactOutputDir = path.resolve(
  'src',
  'contracts',
  'consumer',
  'pacts'
)
export const pactGeneratedDir = path.join(pactOutputDir, 'generated')

const buildPactDirName = (testFileUrl) => {
  const testFilePath = fileURLToPath(testFileUrl)
  const testFileBase = path.basename(testFilePath).replace(/\.test\.js$/, '')
  const testDirBase = path.basename(path.dirname(testFilePath))
  return `${testDirBase}-${testFileBase}`
}

export const buildMessagePactConfig = (testFileUrl) => ({
  consumer: pactConsumer,
  provider: pactProvider,
  dir: path.join(pactGeneratedDir, buildPactDirName(testFileUrl)),
  pactfileWriteMode: 'update'
})
