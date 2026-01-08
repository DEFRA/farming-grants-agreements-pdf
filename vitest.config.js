import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['**/src/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: ['node_modules/', '.server', 'index.js', '**/*.test.js']
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'forks', // Use fork pool for better compatibility with Jest-style mocks
    singleThread: true // Run tests serially similar to Jest --runInBand
  },
  resolve: {
    alias: {
      '~': '.'
    }
  }
})
