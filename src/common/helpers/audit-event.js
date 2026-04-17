import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
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

// Entities affected by each event — each entry is a function of context returning an array of { entity, action, id? }
const eventEntities = {
  [AuditEvent.PDF_UPLOADED_TO_S3]: (context) => [
    { entity: 'agreement', action: 'created', id: context.agreementNumber }
  ]
}

const snsClient = new SNSClient(
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? {
        region: config.get('aws.region'),
        endpoint: config.get('aws.sns.endpoint'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        }
      }
    : {}
)

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
    entities: eventEntities[event](context),
    status,
    details: context
  }
})

/**
 * Records a PDF S3 operation audit event by publishing to SNS.
 * @param {AuditEvent[keyof AuditEvent]} event
 * @param {{ agreementNumber: string, version: string|number, key: string, bucket: string, location?: string, correlationId?: string }} context
 * @param {'success'|'failure'} [status]
 */
export const auditEvent = async (event, context = {}, status = 'success') => {
  await snsClient.send(
    new PublishCommand({
      TopicArn: config.get('aws.sns.topic.audit.arn'),
      Message: JSON.stringify(buildAuditPayload(event, context, status))
    })
  )
}
