import neostandard from 'neostandard'

const config = neostandard({
  env: ['node', 'vitest'],
  ignores: [...neostandard.resolveIgnoresFromGitignore()],
  noJsx: true,
  noStyle: true
})

config.push({
  files: ['**/*.js'],
  rules: {
    'import-x/no-unused-modules': [
      'error',
      {
        unusedExports: true,
        src: ['src/**/!(*.test).js']
      }
    ]
  }
})

config.push({
  files: ['**/*.test.{cjs,js}', '**/test-helpers/**'],
  rules: {
    'import-x/no-unused-modules': [
      'error',
      {
        unusedExports: true,
        src: ['src/**/*.test.js', 'src/**/test-helpers/**/*.js']
      }
    ]
  }
})

export default config
