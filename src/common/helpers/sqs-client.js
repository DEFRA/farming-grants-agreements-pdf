import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'
import { config } from '../../config.js'
import { processMessage } from './sqs-message-processor.js'

/**
 * Hapi plugin for SQS message processing
 * @type {import('@hapi/hapi').Plugin<{
 *   awsRegion: string,
 *   sqsEndpoint: string,
 *   queueUrl: string
 * }>}
 */
export const sqsClientPlugin = {
  plugin: {
    name: 'sqs',
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param { { awsRegion: string, sqsEndpoint: string, queueUrl: string } } options
     * @returns {void}
     */
    register: function (server, options) {
      server.logger.info('Setting up SQS client')

      const sqsClient = new SQSClient({
        region: options.awsRegion,
        endpoint: options.sqsEndpoint
      })

      const app = Consumer.create({
        queueUrl: options.queueUrl,
        handleMessage: async (message) => {
          try {
            await processMessage(message, server.logger)
            server.logger.info(
              `Successfully processed message: ${message.MessageId}`
            )
          } catch (err) {
            server.logger.error(err, 'Failed to process message')
          }
        },
        sqs: sqsClient,
        batchSize: config.get('aws.sqs.maxMessages'),
        waitTimeSeconds: config.get('aws.sqs.waitTime'),
        visibilityTimeout: config.get('aws.sqs.visibilityTimeout'),
        handleMessageTimeout: 30000, // 30 seconds timeout for message processing
        attributeNames: ['All'],
        messageAttributeNames: ['All']
      })

      app.on('error', (err) => {
        server.logger.error(err, 'SQS Consumer error')
      })

      app.on('processing_error', (err) => {
        server.logger.error(err, 'SQS Message processing error')
      })

      app.on('started', () => {
        server.logger.info('SQS Consumer started')
      })

      app.start()

      server.events.on('stop', () => {
        server.logger.info('Stopping SQS consumer')
        app.stop()
        server.logger.info('Closing SQS client')
        sqsClient.destroy()
      })
    }
  },
  options: {
    awsRegion: config.get('aws.region'),
    sqsEndpoint: config.get('aws.sqs.endpoint'),
    queueUrl: config.get('aws.sqs.queueUrl')
  }
}

/**
 * @import { Agreement } from '~/src/api/common/types/agreement.d.js'
 * @import { Message } from '@aws-sdk/client-sqs'
 */
