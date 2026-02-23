const { NODE_ENV } = process.env

/**
 * @type {TransformOptions}
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        modules: NODE_ENV === 'test' ? 'auto' : false
      }
    ]
  ]
}

/**
 * @import { TransformOptions } from '@babel/core'
 */
