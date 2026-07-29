export default {
  rules: {
    'ticket-format': [2, 'always']
  },
  plugins: [
    {
      rules: {
        'ticket-format': ({ header }) => [
          /^(?:[A-Z]+-\d+(?::\s*)?\s+.+|[a-z][a-z0-9-]*(?:\([^)]+\))?!?:\s+.+)$/.test(
            header
          ),
          'Commit message must use either "TICKET-123: message" or "type(scope): message"'
        ]
      }
    }
  ]
}
