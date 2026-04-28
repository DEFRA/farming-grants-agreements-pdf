import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    extensions: []
  },
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/functional/**/*.test.js'],
    exclude: ['**/node_modules/**'],
    testTimeout: 90000,
    hookTimeout: 90000,
    teardownTimeout: 30000,
    pool: 'forks',
    singleThread: true,
    env: {
      NODE_ENV: 'test',
      AWS_REGION: 'eu-west-2',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      S3_BUCKET: 'farming-grants-agreements-pdf-bucket'
      // S3_ENDPOINT is intentionally omitted:
      // - locally: config.js defaults to http://localhost:4568 (Docker Compose host port)
      // - CI: the workflow step sets S3_ENDPOINT=http://localhost:4566 (Floci direct port)
    }
  }
})
