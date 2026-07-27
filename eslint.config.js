import neostandard from 'neostandard'
import importX from 'eslint-plugin-import-x'

const config = neostandard({
  env: ['node', 'vitest'],
  ignores: [...neostandard.resolveIgnoresFromGitignore()],
  noJsx: true,
  noStyle: true
})

config.push({
  files: ['**/*.js'],
  plugins: {
    'import-x': importX
  },
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
  plugins: {
    'import-x': importX
  },
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
