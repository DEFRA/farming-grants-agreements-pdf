import { config } from './config.js'
import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

convict.addFormats(convictFormatWithValidator)

describe('config', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('default values (current config instance)', () => {
    test('should have correct default host', () => {
      expect(config.get('host')).toBe('0.0.0.0')
    })

    test('should have correct default port', () => {
      expect(config.get('port')).toBe(3001)
    })

    test('should have correct default service name', () => {
      expect(config.get('serviceName')).toBe('farming-grants-agreements-pdf')
    })

    test('should have correct default CDP environment', () => {
      expect(config.get('cdpEnvironment')).toBe('local')
    })

    test('should have correct default AWS region', () => {
      expect(config.get('aws.region')).toBe('eu-west-2')
    })

    test('should have correct default S3 bucket name', () => {
      expect(config.get('aws.s3.bucket')).toBe(
        'farming-grants-agreements-pdf-bucket'
      )
    })

    test('should have correct default S3 endpoint', () => {
      expect(config.get('aws.s3.endpoint')).toBe('http://localhost:4566')
    })

    test('should have correct default SNS endpoint', () => {
      expect(config.get('aws.sns.endpoint')).toBe('http://localhost:4566')
    })

    test('should have correct default SNS max attempts', () => {
      expect(config.get('aws.sns.maxAttempts')).toBe(3)
    })

    test('should have correct default SQS endpoint', () => {
      expect(config.get('aws.sqs.endpoint')).toBe('http://localhost:4566')
    })

    test('should have correct default SQS queue URL', () => {
      expect(config.get('aws.sqs.queueUrl')).toBe(
        'http://localhost:4566/000000000000/create_agreement_pdf'
      )
    })

    test('should have correct default SQS interval', () => {
      expect(config.get('aws.sqs.interval')).toBe(10000)
    })

    test('should have correct default log level', () => {
      expect(config.get('log.level')).toBe('info')
    })

    test('should have correct default log format for non-production', () => {
      // Since we're not in production during tests, should default to pino-pretty
      expect(config.get('log.format')).toBe('pino-pretty')
    })

    test('should have correct default log redact paths for non-production', () => {
      // Since we're not in production during tests, should use development redact paths
      expect(config.get('log.redact')).toEqual(['req', 'res', 'responseTime'])
    })

    test('should have correct default metrics setting for non-production', () => {
      // Since we're not in production during tests, metrics should be disabled
      expect(config.get('isMetricsEnabled')).toBe(false)
    })

    test('should have correct default tracing header', () => {
      expect(config.get('tracing.header')).toBe('x-cdp-request-id')
    })
  })

  describe('environment variable configuration', () => {
    test('should create config with environment variable overrides', () => {
      process.env.HOST = '127.0.0.1'
      process.env.PORT = '8080'
      process.env.AWS_REGION = 'us-east-1'
      process.env.S3_BUCKET = 'test-bucket'
      process.env.LOG_LEVEL = 'debug'
      process.env.ENVIRONMENT = 'dev'
      process.env.SERVICE_VERSION = '1.2.3'

      const testConfig = convict({
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
        serviceVersion: {
          doc: 'The service version',
          format: String,
          nullable: true,
          default: null,
          env: 'SERVICE_VERSION'
        },
        cdpEnvironment: {
          doc: 'The CDP environment',
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
        aws: {
          region: {
            doc: 'AWS region',
            format: String,
            default: 'eu-west-2',
            env: 'AWS_REGION'
          },
          s3: {
            bucket: {
              doc: 'S3 bucket name',
              format: String,
              default: 'farming-grants-agreements-pdf-bucket',
              env: 'S3_BUCKET'
            }
          }
        },
        log: {
          level: {
            doc: 'Logging level',
            format: [
              'fatal',
              'error',
              'warn',
              'info',
              'debug',
              'trace',
              'silent'
            ],
            default: 'info',
            env: 'LOG_LEVEL'
          }
        }
      })

      expect(testConfig.get('host')).toBe('127.0.0.1')
      expect(testConfig.get('port')).toBe(8080)
      expect(testConfig.get('aws.region')).toBe('us-east-1')
      expect(testConfig.get('aws.s3.bucket')).toBe('test-bucket')
      expect(testConfig.get('log.level')).toBe('debug')
      expect(testConfig.get('cdpEnvironment')).toBe('dev')
      expect(testConfig.get('serviceVersion')).toBe('1.2.3')
    })
  })

  describe('NODE_ENV specific behavior', () => {
    test('should disable logging when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test'

      const testConfig = convict({
        log: {
          isEnabled: {
            doc: 'Is logging enabled',
            format: Boolean,
            default: process.env.NODE_ENV !== 'test',
            env: 'LOG_ENABLED'
          }
        }
      })

      expect(testConfig.get('log.isEnabled')).toBe(false)
    })

    test('should enable logging when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development'

      const testConfig = convict({
        log: {
          isEnabled: {
            doc: 'Is logging enabled',
            format: Boolean,
            default: process.env.NODE_ENV !== 'test',
            env: 'LOG_ENABLED'
          }
        }
      })

      expect(testConfig.get('log.isEnabled')).toBe(true)
    })

    test('should use ecs log format in production', () => {
      process.env.NODE_ENV = 'production'

      const testConfig = convict({
        log: {
          format: {
            doc: 'Format to output logs in',
            format: ['ecs', 'pino-pretty'],
            default:
              process.env.NODE_ENV === 'production' ? 'ecs' : 'pino-pretty',
            env: 'LOG_FORMAT'
          }
        }
      })

      expect(testConfig.get('log.format')).toBe('ecs')
    })

    test('should use pino-pretty log format in non-production', () => {
      process.env.NODE_ENV = 'development'

      const testConfig = convict({
        log: {
          format: {
            doc: 'Format to output logs in',
            format: ['ecs', 'pino-pretty'],
            default:
              process.env.NODE_ENV === 'production' ? 'ecs' : 'pino-pretty',
            env: 'LOG_FORMAT'
          }
        }
      })

      expect(testConfig.get('log.format')).toBe('pino-pretty')
    })

    test('should enable metrics in production', () => {
      process.env.NODE_ENV = 'production'

      const testConfig = convict({
        isMetricsEnabled: {
          doc: 'Enable metrics reporting',
          format: Boolean,
          default: process.env.NODE_ENV === 'production',
          env: 'ENABLE_METRICS'
        }
      })

      expect(testConfig.get('isMetricsEnabled')).toBe(true)
    })

    test('should disable metrics in non-production', () => {
      process.env.NODE_ENV = 'development'

      const testConfig = convict({
        isMetricsEnabled: {
          doc: 'Enable metrics reporting',
          format: Boolean,
          default: process.env.NODE_ENV === 'production',
          env: 'ENABLE_METRICS'
        }
      })

      expect(testConfig.get('isMetricsEnabled')).toBe(false)
    })

    test('should have production log redact paths in production', () => {
      process.env.NODE_ENV = 'production'

      const testConfig = convict({
        log: {
          redact: {
            doc: 'Log paths to redact',
            format: Array,
            default:
              process.env.NODE_ENV === 'production'
                ? [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'res.headers'
                  ]
                : ['req', 'res', 'responseTime']
          }
        }
      })

      expect(testConfig.get('log.redact')).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
    })

    test('should have development log redact paths in non-production', () => {
      process.env.NODE_ENV = 'development'

      const testConfig = convict({
        log: {
          redact: {
            doc: 'Log paths to redact',
            format: Array,
            default:
              process.env.NODE_ENV === 'production'
                ? [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'res.headers'
                  ]
                : ['req', 'res', 'responseTime']
          }
        }
      })

      expect(testConfig.get('log.redact')).toEqual([
        'req',
        'res',
        'responseTime'
      ])
    })
  })

  describe('isProduction conditional logic coverage', () => {
    test('should use ecs log format when isProduction is true', () => {
      process.env.NODE_ENV = 'production'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        log: {
          format: {
            doc: 'Format to output logs in',
            format: ['ecs', 'pino-pretty'],
            default: isProduction ? 'ecs' : 'pino-pretty',
            env: 'LOG_FORMAT'
          }
        }
      })

      expect(testConfig.get('log.format')).toBe('ecs')
    })

    test('should use pino-pretty log format when isProduction is false', () => {
      process.env.NODE_ENV = 'development'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        log: {
          format: {
            doc: 'Format to output logs in',
            format: ['ecs', 'pino-pretty'],
            default: isProduction ? 'ecs' : 'pino-pretty',
            env: 'LOG_FORMAT'
          }
        }
      })

      expect(testConfig.get('log.format')).toBe('pino-pretty')
    })

    test('should use production redact paths when isProduction is true', () => {
      process.env.NODE_ENV = 'production'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        log: {
          redact: {
            doc: 'Log paths to redact',
            format: Array,
            default: isProduction
              ? [
                  'req.headers.authorization',
                  'req.headers.cookie',
                  'res.headers'
                ]
              : ['req', 'res', 'responseTime']
          }
        }
      })

      expect(testConfig.get('log.redact')).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
    })

    test('should use development redact paths when isProduction is false', () => {
      process.env.NODE_ENV = 'development'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        log: {
          redact: {
            doc: 'Log paths to redact',
            format: Array,
            default: isProduction
              ? [
                  'req.headers.authorization',
                  'req.headers.cookie',
                  'res.headers'
                ]
              : ['req', 'res', 'responseTime']
          }
        }
      })

      expect(testConfig.get('log.redact')).toEqual([
        'req',
        'res',
        'responseTime'
      ])
    })

    test('should enable metrics when isProduction is true', () => {
      process.env.NODE_ENV = 'production'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        isMetricsEnabled: {
          doc: 'Enable metrics reporting',
          format: Boolean,
          default: isProduction,
          env: 'ENABLE_METRICS'
        }
      })

      expect(testConfig.get('isMetricsEnabled')).toBe(true)
    })

    test('should disable metrics when isProduction is false', () => {
      process.env.NODE_ENV = 'development'
      const isProduction = process.env.NODE_ENV === 'production'

      const testConfig = convict({
        isMetricsEnabled: {
          doc: 'Enable metrics reporting',
          format: Boolean,
          default: isProduction,
          env: 'ENABLE_METRICS'
        }
      })

      expect(testConfig.get('isMetricsEnabled')).toBe(false)
    })
  })

  describe('production config evaluation', () => {
    test('should evaluate main config with production defaults when NODE_ENV is production', async () => {
      // Set NODE_ENV to production before importing config
      process.env.NODE_ENV = 'production'

      // Clear the module cache to force re-evaluation
      jest.resetModules()

      // Re-import the config module to trigger evaluation with production NODE_ENV
      const { config: prodConfig } = await import('./config.js')

      // Test that production branches were taken
      expect(prodConfig.get('log.format')).toBe('ecs')
      expect(prodConfig.get('log.redact')).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
      expect(prodConfig.get('isMetricsEnabled')).toBe(true)
    })
  })

  describe('validation', () => {
    test('should accept valid CDP environment values', () => {
      const validEnvironments = [
        'local',
        'infra-dev',
        'management',
        'dev',
        'test',
        'perf-test',
        'ext-test',
        'prod'
      ]

      validEnvironments.forEach((env) => {
        const testConfig = convict({
          cdpEnvironment: {
            doc: 'The CDP environment',
            format: validEnvironments,
            default: env,
            env: 'ENVIRONMENT'
          }
        })

        expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
      })
    })

    test('should accept valid log levels', () => {
      const validLevels = [
        'fatal',
        'error',
        'warn',
        'info',
        'debug',
        'trace',
        'silent'
      ]

      validLevels.forEach((level) => {
        const testConfig = convict({
          log: {
            level: {
              doc: 'Logging level',
              format: validLevels,
              default: level,
              env: 'LOG_LEVEL'
            }
          }
        })

        expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
      })
    })

    test('should accept valid log formats', () => {
      const validFormats = ['ecs', 'pino-pretty']

      validFormats.forEach((format) => {
        const testConfig = convict({
          log: {
            format: {
              doc: 'Format to output logs in',
              format: validFormats,
              default: format,
              env: 'LOG_FORMAT'
            }
          }
        })

        expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
      })
    })

    test('should validate port as number within valid range', () => {
      const testConfig = convict({
        port: {
          doc: 'The port to bind',
          format: 'port',
          default: 65535,
          env: 'PORT'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
    })

    test('should validate host as IP address', () => {
      const testConfig = convict({
        host: {
          doc: 'The IP address to bind',
          format: 'ipaddress',
          default: '192.168.1.1',
          env: 'HOST'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
    })
  })

  describe('AWS configuration', () => {
    test('should have correct AWS access key defaults for local development', () => {
      expect(config.get('aws.accessKeyId')).toBe('test')
      expect(config.get('aws.secretAccessKey')).toBe('test')
    })

    test('should override AWS credentials from environment variables', () => {
      process.env.AWS_ACCESS_KEY_ID = 'real-access-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'real-secret-key'

      const testConfig = convict({
        aws: {
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
          }
        }
      })

      expect(testConfig.get('aws.accessKeyId')).toBe('real-access-key')
      expect(testConfig.get('aws.secretAccessKey')).toBe('real-secret-key')
    })

    test('should have correct SNS topic configuration', () => {
      expect(config.get('aws.sns.topic.offerAccepted.arn')).toBe(
        'arn:aws:sns:eu-west-2:000000000000:agreement_accepted'
      )
      expect(config.get('aws.sns.topic.offerAccepted.type')).toBe(
        'io.onsite.agreement.offer.accepted'
      )
    })

    test('should have correct SNS event source', () => {
      expect(config.get('aws.sns.eventSource')).toBe('urn:service:agreement')
    })
  })

  describe('SQS configuration', () => {
    test('should have correct SQS defaults', () => {
      expect(config.get('aws.sqs.maxMessages')).toBe(1)
      expect(config.get('aws.sqs.visibilityTimeout')).toBe(10)
      expect(config.get('aws.sqs.waitTime')).toBe(5)
    })

    test('should override SQS configuration from environment variables', () => {
      process.env.MAX_NUMBER_OF_MESSAGES = '10'
      process.env.VISIBILITY_TIMEOUT = '30'
      process.env.WAIT_TIME_SECONDS = '20'

      const testConfig = convict({
        aws: {
          sqs: {
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
        }
      })

      expect(testConfig.get('aws.sqs.maxMessages')).toBe(10)
      expect(testConfig.get('aws.sqs.visibilityTimeout')).toBe(30)
      expect(testConfig.get('aws.sqs.waitTime')).toBe(20)
    })
  })

  describe('nullable fields', () => {
    test('should allow null service version', () => {
      expect(config.get('serviceVersion')).toBeNull()
    })

    test('should allow null HTTP proxy', () => {
      expect(config.get('httpProxy')).toBeNull()
    })

    test('should set service version when provided', () => {
      process.env.SERVICE_VERSION = '1.0.0'

      const testConfig = convict({
        serviceVersion: {
          doc: 'The service version',
          format: String,
          nullable: true,
          default: null,
          env: 'SERVICE_VERSION'
        }
      })

      expect(testConfig.get('serviceVersion')).toBe('1.0.0')
    })

    test('should set HTTP proxy when provided', () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080'

      const testConfig = convict({
        httpProxy: {
          doc: 'HTTP Proxy URL',
          format: String,
          nullable: true,
          default: null,
          env: 'HTTP_PROXY'
        }
      })

      expect(testConfig.get('httpProxy')).toBe('http://proxy.example.com:8080')
    })
  })
})
