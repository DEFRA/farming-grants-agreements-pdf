import neostandard from 'neostandard'

const configs = neostandard({
  env: ['node', 'vitest'],
  ignores: [...neostandard.resolveIgnoresFromGitignore()],
  noJsx: true,
  noStyle: true
})

export default configs.map((config) => {
  if (config.languageOptions) {
    return {
      ...config,
      languageOptions: {
        ...config.languageOptions,
        parserOptions: {
          ...config.languageOptions.parserOptions,
          ecmaVersion: 'latest'
        }
      }
    }
  }
  return config
})
