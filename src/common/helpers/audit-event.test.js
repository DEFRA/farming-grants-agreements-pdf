import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      cdpEnvironment: 'test',
      serviceName: 'farming-grants-agreements-pdf'
    }
    return configMap[key]
  })
)

vi.mock('#~/config.js', () => ({ config: { get: mockConfigGet } }))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
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
  let audit
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct top-level fields for upload', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      location: 's3://test-bucket/base/FPTT123456789/1/FPTT123456789-1.pdf',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: 'corr-xyz',
        datetime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        environment: 'test',
        application: 'Grants',
        component: 'farming-grants-agreements-pdf'
      })
    )
  })

  test('calls audit with correct security fields', () => {
    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          pmccode: '0201',
          details: expect.objectContaining({
            transactioncode: '2307',
            message: 'PDF document uploaded to S3',
            additionalinfo: 'agreementNumber: FPTT123456789'
          })
        })
      })
    )
  })

  test('calls audit with correct audit fields for upload', () => {
    const context = {
      agreementNumber: 'FPTT123456789',
      version: '1',
      key: 'base/FPTT123456789/1/FPTT123456789-1.pdf',
      bucket: 'test-bucket',
      location: 's3://test-bucket/base/FPTT123456789/1/FPTT123456789-1.pdf',
      correlationId: 'corr-xyz'
    }

    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsUploadAgreement',
          action: 'created',
          entity: 'agreement',
          entityid: 'FPTT123456789',
          status: 'success',
          details: context
        })
      })
    )
  })

  test('audit.action for PDF_UPLOADED_TO_S3 is a valid action value', () => {
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

    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [[payload]] = audit.mock.calls
    expect(validActions).toContain(payload.audit.action)
  })

  test('audit.entity is "agreement"', () => {
    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {
      agreementNumber: 'FPTT123456789'
    })

    const [[payload]] = audit.mock.calls
    expect(payload.audit.entity).toBe('agreement')
  })

  test('passes failure status through to the audit payload', () => {
    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3, {}, 'failure')

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ status: 'failure' })
      })
    )
  })

  test('handles empty context gracefully', () => {
    auditEvent(AuditEvent.PDF_UPLOADED_TO_S3)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: undefined,
        audit: expect.objectContaining({ entityid: undefined })
      })
    )
  })
})
