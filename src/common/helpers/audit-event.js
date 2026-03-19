import { audit } from '@defra/cdp-auditing'
import { config } from '#~/config.js'

export const AuditEvent = Object.freeze({
  PDF_UPLOADED_TO_S3: 'PDF_UPLOADED_TO_S3'
})

// Human-readable description for each audit event, used in security.details.message
const eventMessages = {
  [AuditEvent.PDF_UPLOADED_TO_S3]: 'PDF document uploaded to S3'
}

// Transaction code for each audit event, used in security.details.transactioncode
const eventTransactionCodes = {
  [AuditEvent.PDF_UPLOADED_TO_S3]: '2307'
}

/**
 * Builds the full audit payload for a PDF S3 operation.
 *
 * @param {AuditEvent[keyof AuditEvent]} event
 * @param {{ agreementNumber: string, version: string|number, key: string, bucket: string, location?: string, correlationId?: string }} context
 * @param {'success'|'failure'} status
 */
const buildAuditPayload = (event, context = {}, status = 'success') => ({
  correlationid: context.correlationId,
  datetime: new Date().toISOString(),
  environment: config.get('cdpEnvironment'),
  version: '0.1.0',
  application: 'Grants',
  component: config.get('serviceName'),

  security: {
    pmccode: '0201', // logs must record when content is imported (uploaded) or exported (downloaded) by any user (internal or external) or system component.
    priority: '0',
    details: {
      transactioncode: eventTransactionCodes[event],
      message: eventMessages[event],
      additionalinfo: `agreementNumber: ${context.agreementNumber}`
    }
  },

  audit: {
    eventtype: 'GrantsUploadAgreement',
    action: event,
    entity: 'Agreements',
    entityid: context.agreementNumber,
    status,
    details: context
  }
})

/**
 * Records a PDF S3 operation audit event.
 * @param {AuditEvent[keyof AuditEvent]} event
 * @param {{ agreementNumber: string, version: string|number, key: string, bucket: string, location?: string, correlationId?: string }} context
 * @param {'success'|'failure'} [status]
 */
export const auditEvent = (event, context = {}, status = 'success') => {
  audit(buildAuditPayload(event, context, status))
}
