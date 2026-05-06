import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { uploadPdf } from '#~/services/file-upload.js'

vi.mock('#~/common/helpers/audit-event.js', () => ({
  auditEvent: vi.fn(),
  AuditEvent: { PDF_UPLOADED_TO_S3: 'PDF_UPLOADED_TO_S3' }
}))

const FIXTURE_SIZE = 32 * 1024 * 1024
const BUCKET = process.env.S3_BUCKET ?? 'farming-grants-agreements-pdf-bucket'
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:4568'

// Independent client for post-upload assertions — does not share the singleton from file-upload.js
const verificationClient = new S3Client({
  region: 'eu-west-2',
  endpoint: S3_ENDPOINT,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  forcePathStyle: true
})

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}

let fixturePath
let testPdfPath
let uploadedKey

describe('Large PDF upload (>30MB) — functional', () => {
  beforeAll(async () => {
    fixturePath = path.join(os.tmpdir(), 'defra-pdf-functional-fixture.pdf')
    const buf = Buffer.alloc(FIXTURE_SIZE)
    Buffer.from('%PDF-1.4\n').copy(buf, 0)
    await fs.writeFile(fixturePath, buf)

    try {
      await verificationClient.send(new HeadBucketCommand({ Bucket: BUCKET }))
    } catch {
      throw new Error(
        `floci S3 not reachable at ${S3_ENDPOINT} (bucket: ${BUCKET}). ` +
          'Is Floci running? Run: docker compose up'
      )
    }
  })

  afterAll(async () => {
    await fs.unlink(fixturePath).catch(() => {})
  })

  beforeEach(async () => {
    testPdfPath = path.join(
      os.tmpdir(),
      `defra-pdf-functional-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
    )
    await fs.copyFile(fixturePath, testPdfPath)
    uploadedKey = undefined
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (uploadedKey) {
      await verificationClient
        .send(new DeleteObjectCommand({ Bucket: BUCKET, Key: uploadedKey }))
        .catch(() => {})
    }
  })

  test('S3 key follows the retention-prefix/agreement/version/filename structure', async () => {
    // endDate 2045-01-01 always produces 'maximum' prefix regardless of current date:
    // differenceInYears(2045, nextMonth) + retentionBaseYears(7) >> extendedTermThreshold(15)
    const result = await uploadPdf(
      testPdfPath,
      'AGR001-1.pdf',
      'AGR001',
      '1',
      new Date('2045-01-01'),
      mockLogger
    )

    uploadedKey = result?.key

    expect(result.key).toMatch(
      /^(base|extended|maximum)\/AGR001\/1\/AGR001-1\.pdf$/
    )
  })
})
