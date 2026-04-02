#!/bin/bash
set -e

echo "🚀 Initializing S3 in Floci..."

# SNS and SQS config is being done in the farming-grants-agreements-api service
# for simplicity, readability and maintainability

# Define S3 bucket for generated PDFs
declare S3_BUCKET="s3://farming-grants-agreements-pdf-bucket"

# Set default values for AWS CLI
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}
AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-eu-west-2}

ENDPOINT="${AWS_ENDPOINT:-http://floci:4566}"
run() {
  aws --endpoint-url "$ENDPOINT" "$@"
}

# Create S3 bucket
run s3 mb ${S3_BUCKET}
echo "✅ Created S3 bucket: ${S3_BUCKET} for endpoint ${ENDPOINT}"

echo "✅ SNS and SQS setup complete."
