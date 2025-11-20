import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

convict.addFormats(convictFormatWithValidator)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const localstackEndpoint = 'http://localhost:4566'

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'farming-grants-agreements-pdf'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  jwtSecret: {
    doc: 'JWT Secret',
    format: String,
    default: 'a-string-secret-at-least-256-bits-long',
    env: 'AGREEMENTS_JWT_SECRET'
  },
  tmpPdfFolder: {
    doc: 'Temporary folder for PDF generation',
    format: String,
    default: '/tmp/defra-pdf',
    env: 'TMP_PDF_FOLDER'
  },
  aws: {
    region: {
      doc: 'AWS region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    accessKeyId: {
      doc: 'AWS access key ID',
      format: String,
      default: 'test',
      env: 'AWS_ACCESS_KEY_ID'
    },
    secretAccessKey: {
      doc: 'AWS secret access key',
      format: String,
      default: 'test',
      env: 'AWS_SECRET_ACCESS_KEY'
    },
    s3: {
      bucket: {
        doc: 'S3 bucket name',
        format: String,
        default: 'farming-grants-agreements-pdf-bucket',
        env: 'S3_BUCKET'
      },
      baseTermPrefix: {
        doc: 'S3 key prefix for base term retention (10 years)',
        format: String,
        default: 'base',
        env: 'FILES_S3_BASE_TERM_PREFIX'
      },
      extendedTermPrefix: {
        doc: 'S3 key prefix for extended term retention (15 years)',
        format: String,
        default: 'extended',
        env: 'FILES_S3_EXTENDED_TERM_PREFIX'
      },
      maximumTermPrefix: {
        doc: 'S3 key prefix for maximum term retention (20 years)',
        format: String,
        default: 'maximum',
        env: 'FILES_S3_MAXIMUM_TERM_PREFIX'
      },
      baseTermThreshold: {
        doc: 'Threshold in years for base term retention period',
        format: Number,
        default: 10,
        env: 'FILES_S3_BASE_TERM_THRESHOLD'
      },
      extendedTermThreshold: {
        doc: 'Threshold in years for extended term retention period',
        format: Number,
        default: 15,
        env: 'FILES_S3_EXTENDED_TERM_THRESHOLD'
      },
      maximumTermThreshold: {
        doc: 'Threshold in years for maximum term retention period',
        format: Number,
        default: 20,
        env: 'FILES_S3_MAXIMUM_TERM_THRESHOLD'
      },
      retentionBaseYears: {
        doc: 'Base number of years added to agreement end date for retention calculation',
        format: Number,
        default: 7,
        env: 'FILES_S3_RETENTION_BASE_YEARS'
      },
      endpoint: {
        doc: 'The S3 HTTP(S) endpoint, if required (e.g. a local development dev service). Activating this will force path style addressing for compatibility with Localstack.',
        format: String,
        default: localstackEndpoint,
        env: 'S3_ENDPOINT'
      }
    },
    sns: {
      endpoint: {
        doc: 'AWS SNS endpoint',
        format: String,
        default: localstackEndpoint,
        env: 'SNS_ENDPOINT'
      },
      maxAttempts: {
        doc: 'AWS SNS max publish attempts before error',
        format: Number,
        default: 3,
        env: 'SNS_MAX_ATTEMPTS'
      },
      eventSource: {
        doc: 'AWS SNS Cloud event source for emitted events',
        format: String,
        default: 'urn:service:agreement',
        env: 'SNS_EVENT_SOURCE'
      },
      topic: {
        offerAccepted: {
          arn: {
            doc: 'AWS SNS Topic ARN for Offer Accepted events',
            format: String,
            default:
              'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
            env: 'SNS_TOPIC_ARN_AGREEMENT_STATUS_UPDATED'
          },
          type: {
            doc: 'AWS SNS Topic type for Offer Accepted events',
            format: String,
            default: 'io.onsite.agreement.status.updated',
            env: 'SNS_TOPIC_TYPE_AGREEMENT_STATUS_UPDATED'
          }
        }
      }
    },
    sqs: {
      endpoint: {
        doc: 'AWS SQS endpoint',
        format: String,
        default: localstackEndpoint,
        env: 'SQS_ENDPOINT'
      },
      queueUrl: {
        doc: 'Queue URL',
        format: String,
        default: 'http://localhost:4566/000000000000/create_agreement_pdf',
        env: 'QUEUE_URL'
      },
      interval: {
        doc: 'SQS Interval',
        format: Number,
        default: 10000,
        env: 'SQS_INTERVAL'
      },
      maxMessages: {
        doc: 'Max number of messages to receive from SQS',
        format: Number,
        default: 1,
        env: 'MAX_NUMBER_OF_MESSAGES'
      },
      visibilityTimeout: {
        doc: 'Visibility timeout for SQS messages',
        format: Number,
        default: 10,
        env: 'VISIBILITY_TIMEOUT'
      },
      waitTime: {
        doc: 'Wait time for SQS messages',
        format: Number,
        default: 5,
        env: 'WAIT_TIME_SECONDS'
      }
    }
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
