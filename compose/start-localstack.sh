#!/bin/bash
set -e

echo "🚀 Initializing S3 in LocalStack..."

# SNS and SQS config is being done in the farming-grants-agreements-api service
# for simplicity, readability and maintainability

# Define S3 bucket for generated PDFs
declare S3_BUCKET="s3://farming-grants-agreements-pdf-bucket"

# Create S3 bucket
awslocal --endpoint-url=${S3_ENDPOINT} s3 mb ${S3_BUCKET}
echo "✅ Created S3 bucket: ${S3_BUCKET} for endpoint ${S3_ENDPOINT}"

echo "✅ SNS and SQS setup complete."
