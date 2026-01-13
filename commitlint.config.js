export default {
  rules: {
    'ticket-format': [2, 'always']
  },
  plugins: [
    {
      rules: {
        'ticket-format': ({ header }) => [
          /^[A-Z]+-\d+(?::\s*)?\s+.+$/.test(header),
          'Commit message must be in the format: TICKET-123: message'
        ]
      }
    }
  ]
}
