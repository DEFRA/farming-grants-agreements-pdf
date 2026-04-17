import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockSnsClientSend = vi.hoisted(() => vi.fn())

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      cdpEnvironment: 'test',
      serviceName: 'farming-grants-agreements-pdf',
      'aws.region': 'eu-west-2',
      'aws.sns.endpoint': 'http://localhost:4566',
      'aws.accessKeyId': 'test',
      'aws.secretAccessKey': 'test',
      'aws.sns.topic.audit.arn':
        'arn:aws:sns:eu-west-2:000000000000:fcp_audit_farming_grants_agreements_pdf'
    }
    return configMap[key]
  })
)

vi.mock('#~/config.js', () => ({ config: { get: mockConfigGet } }))

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: class MockSNSClient {
    send(command) {
      return mockSnsClientSend(command)
    }
  },
  PublishCommand: class MockPublishCommand {
    constructor(params) {
      Object.assign(this, params)
    }
  }
}))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    ;({ AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('is frozen', () => {
    expect(Object.isFrozen(AuditEvent)).toBe(true)
  })

  test('contains expected event keys', () => {
    expect(AuditEvent.PDF_UPLOADED_TO_S3).toBe('PDF_UPLOADED_TO_S3')
  })

  test('cannot be mutated', () => {
    expect(() => {
      AuditEvent.NEW_KEY = 'value'
    }).toThrow(TypeError)
    expect(AuditEvent.NEW_KEY).toBeUndefined()
  })
})

describe('auditEvent', () => {
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    mockSnsClientSend.mockResolvedValue({})
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('publishes to SNS with correct TopicArn', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    expect(mockSnsClientSend).toHaveBeenCalledOnce()
    const [command] = mockSnsClientSend.mock.calls[0]
    expect(command.TopicArn).toBe(
      'arn:aws:sns:eu-west-2:000000000000:fcp_audit_farming_grants_agreements_pdf'
    )
  })

  test('publishes correct top-level fields for upload', async () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      location: 's3://test-bucket/base/FPTT123456789/1/FPTT123456789-1.pdf',
      correlationId: 'corr-xyz'
    }

    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, context)

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)

    expect(payload).toMatchObject({
      correlationid: 'corr-xyz',
      datetime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      environment: 'test',
      application: 'Grants',
      component: 'farming-grants-agreements-pdf'
    })
  })

  test('publishes correct security fields', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)

    expect(payload.security).toMatchObject({
      pmccode: '0201',
      details: {
        transactioncode: '2307',
        message: 'PDF document uploaded to S3',
        additionalinfo: 'agreementNumber: FPTT123456789'
      }
    })
  })

  test('publishes correct audit fields for upload', async () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      location: 's3://test-bucket/base/FPTT123456789/1/FPTT123456789-1.pdf',
      correlationId: 'corr-xyz'
    }

    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, context)

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)

    expect(payload.audit).toMatchObject({
      eventtype: 'GrantsUploadAgreement',
      entities: [
        { entity: 'agreement', action: 'created', id: 'FPTT123456789' }
      ],
      status: 'success',
      details: context
    })
  })

  test('audit.entities contains valid action values', async () => {
    const validActions = [
      'created',
      'read',
      'updated',
      'deleted',
      'submitted',
      'accepted',
      'rejected',
      'withdrawn'
    ]

    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    for (const entry of payload.audit.entities) {
      expect(validActions).toContain(entry.action)
    }
  })

  test('audit.entities entries each have an entity property', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    for (const entry of payload.audit.entities) {
      expect(typeof entry.entity).toBe('string')
    }
  })

  test('audit.accounts is always present', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    expect(payload.audit.accounts).toBeDefined()
    expect(typeof payload.audit.accounts).toBe('object')
  })

  test('audit.accounts is populated from known context fields', async () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      sbi: '123456789',
      frn: '9876543210',
      crn: 'crn-001'
    }

    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, context)

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    expect(payload.audit.accounts).toEqual({
      sbi: '123456789',
      frn: '9876543210',
      crn: 'crn-001'
    })
  })

  test('passes failure status through to the published payload', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {}, 'failure')

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    expect(payload.audit.status).toBe('failure')
  })

  test('handles empty context gracefully', async () => {
    await auditEvent(AuditEvent.PDF_UPLOADED_TO_S3)

    const [command] = mockSnsClientSend.mock.calls[0]
    const payload = JSON.parse(command.Message)
    expect(payload.correlationid).toBeUndefined()
    expect(payload.audit.entities[0].id).toBeUndefined()
  })
})
