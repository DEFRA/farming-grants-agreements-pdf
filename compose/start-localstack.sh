#!/bin/bash
set -e

# Match the region your JS app uses by default
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "🚀 Initializing SNS + SQS in LocalStack..."

# Define S3 bucket for generated PDFs
declare S3_BUCKET="farming-grants-agreements-pdf-bucket"

# Define associative arrays for topics and queues
declare -A TOPICS=(
  [offer_accepted]="agreement_accepted"               # - User has accepted the offer
)
declare -A QUEUES=(
  [offer_accepted]="create_agreement_pdf" # We need to create the agreement PDF in response to the offer being accepted
)

# Associative arrays for ARNs and URLs
declare -A TOPIC_ARNS
declare -A QUEUE_URLS
declare -A QUEUE_ARNS

# Create SNS topics
for key in "${!TOPICS[@]}"; do
  topic_name="${TOPICS[$key]}"
  arn=$(awslocal sns create-topic --name "$topic_name" --query 'TopicArn' --output text)
  TOPIC_ARNS[$key]="$arn"
  echo "✅ Created topic: $arn"
done

# Create SQS queues and get ARNs
for key in "${!QUEUES[@]}"; do
  queue_name="${QUEUES[$key]}"
  url=$(awslocal sqs create-queue --queue-name "$queue_name" --query 'QueueUrl' --output text)
  arn=$(awslocal sqs get-queue-attributes --queue-url "$url" --attribute-name QueueArn --query "Attributes.QueueArn" --output text)
  QUEUE_URLS[$key]="$url"
  QUEUE_ARNS[$key]="$arn"
  echo "✅ Created queue: $url"
done


wait_for_topic() {
  local arn="$1"
  local name="$2"
  echo "⏳ Waiting for SNS topic to be available: ${name}"
  for i in {1..10}; do
    if awslocal sns get-topic-attributes --topic-arn "$arn" > /dev/null 2>&1; then
      echo "✅ Topic is now available: ${name}"
      return 0
    fi
    echo "🔄 Still waiting for ${name}..."
    sleep 1
  done
  echo "⚠️  Timeout waiting for topic: ${name}"
}

# Ensure all topics are fully registered
for key in "${!TOPICS[@]}"; do
  wait_for_topic "${TOPIC_ARNS[$key]}" "${TOPICS[$key]}"
done

# Subscribe each queue to its topic
for key in "${!TOPICS[@]}"; do
  awslocal sns subscribe \
    --topic-arn "${TOPIC_ARNS[$key]}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARNS[$key]}" \
    --attributes '{ "RawMessageDelivery": "true"}'
  echo "🔗 Subscribed queue to topic: ${QUEUE_ARNS[$key]}"
done

# Optional extras

awslocal --endpoint-url=http://localhost:4566 s3 mb s3://${S3_BUCKET}
echo "✅ Created S3 bucket: ${S3_BUCKET}"

echo "✅ SNS and SQS setup complete."
