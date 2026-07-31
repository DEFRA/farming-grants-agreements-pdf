import { readFileSync } from 'node:fs'
import { gitignoreToMinimatch } from '@humanwhocodes/gitignore-to-minimatch'
import js from '@eslint/js'
import globals from 'globals'

const ignores = readFileSync(new URL('.gitignore', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map(gitignoreToMinimatch)

export default [
  {
    ignores
  },
  js.configs.recommended,
  {
    files: ['**/*.{cjs,js}'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['**/*.test.{cjs,js}', '**/__mocks__/**', '**/test-helpers/**'],
    languageOptions: {
      globals: globals.vitest
    }
  }
]
