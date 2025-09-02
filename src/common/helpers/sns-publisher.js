import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../../config.js'

const snsClient = new SNSClient(
  process.env.NODE_ENV === 'development'
    ? {
        region: config.get('aws.region'),
        endpoint: config.get('aws.sns.endpoint'),
        credentials: {
          accessKeyId: config.get('aws.accessKeyId'),
          secretAccessKey: config.get('aws.secretAccessKey')
        }
      }
    : // Production will automatically use the default credentials
      {}
)

/**
 * Publish an SNS message with basic retry on transient errors
 * @param {object} params
 * @param {string} params.topicArn - SNS Topic ARN
 * @param {string} params.type - CloudEvent type
 * @param {string} params.time - ISO timestamp
 * @param {object} params.data - Event payload
 * @param {Request<ReqRefDefaults>['logger']} logger
 * @param {object} client - SNS client optional for testing
 * @returns {Promise<void>}
 */
export async function publishEvent(
  { topicArn, type, time, data },
  logger,
  client = snsClient
) {
  const message = {
    id: uuidv4(),
    source: config.get('aws.sns.eventSource'),
    specversion: '1.0',
    type,
    time,
    datacontenttype: 'application/json',
    data
  }

  const maxAttempts = config.get('aws.sns.maxAttempts')
  let attempt = 0
  let lastError

  while (attempt < maxAttempts) {
    try {
      await client.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify(message)
        })
      )
      logger?.info?.(
        `Published event to SNS topic: ${topicArn} type: ${type} id: ${message.id}`
      )
      return
    } catch (error) {
      lastError = error
      const isRetryable =
        error?.$metadata?.httpStatusCode >= 500 ||
        error?.name === 'ThrottlingException' ||
        error?.name === 'TimeoutError' ||
        error?.name === 'NetworkingError'

      logger?.error?.('Failed to publish event to SNS', {
        attempt: attempt + 1,
        maxAttempts,
        error: error?.message,
        code: error?.name,
        stack: error?.stack
      })

      if (!isRetryable || attempt === maxAttempts - 1) {
        break
      }

      // exponential backoff
      const waitTime = 5000
      const backoffMs = Math.min(1000 * 2 ** attempt, waitTime)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      attempt += 1
    }
  }

  throw lastError
}

/** @import { Request } from '@hapi/hapi' */
